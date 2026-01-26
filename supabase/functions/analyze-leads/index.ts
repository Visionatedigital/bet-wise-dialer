import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch unscored leads
        // Leads with null score or 0 score (though 0 could be valid, usually it's default)
        const { data: leads, error: fetchError } = await supabaseClient
            .from('leads')
            .select('id, intent, lead_score, analysis_notes')
            // Target: Null score, 0 score, OR old "AI Backfill" notes (rule-based)
            .or('lead_score.is.null,lead_score.eq.0,analysis_notes.ilike.AI Backfill%')
            .not('intent', 'is', null) // Need intent to parse player ID
            .limit(5); // Reduce batch size for OpenAI processing (timeout prevention)

        if (fetchError) throw fetchError;

        if (!leads || leads.length === 0) {
            return new Response(
                JSON.stringify({ message: 'No unscored leads found.', processed: 0 }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Processing ${leads.length} leads...`);

        const mockApiUrl = `${supabaseUrl}/functions/v1/mock-bangbet-api/api`;
        let processedCount = 0;
        const debugLogs: string[] = [];

        debugLogs.push(`[System] Starting analysis batch for ${leads.length} leads...`);

        // 2. Process each lead
        await Promise.all(leads.map(async (lead) => {
            // Extract Player ID from "Player {id}" intent
            // Or if intent is just the ID? Assuming "Player {id}" based on sync function
            const match = (lead.intent || '').match(/Player\s+(.+)/i);
            const playerId = match ? match[1] : (lead.intent?.includes(' ') ? null : lead.intent);

            if (!playerId) {
                console.log(`Skipping lead ${lead.id}: Could not parse player ID from intent '${lead.intent}'`);
                debugLogs.push(`[Skip] Lead ${lead.id}: No Valid Player ID in intent '${lead.intent}'`);
                return;
            }

            // Fetch Profile & Patterns
            let lifetimeValue = 0;
            let preferredProduct = "unknown";
            let bettingPatterns = {};

            try {
                // Fetch profile
                debugLogs.push(`[AI Request] Fetching profile data for Player ${playerId}...`);
                const profileRes = await fetch(`${mockApiUrl}/players/${playerId}/profile`, {
                    headers: { "Authorization": `Bearer ${supabaseAnonKey}`, "apikey": supabaseAnonKey }
                });
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    if (profileData.success) {
                        lifetimeValue = profileData.data.financial?.lifetime_value || 0;
                        preferredProduct = profileData.data.preferences?.favorite_product || "unknown";
                        debugLogs.push(`[Data Received] Player ${playerId}: LTV=${lifetimeValue}, Pref=${preferredProduct}`);
                    }
                }

                // Fetch patterns
                const patternsRes = await fetch(`${mockApiUrl}/players/${playerId}/betting-patterns`, {
                    headers: { "Authorization": `Bearer ${supabaseAnonKey}`, "apikey": supabaseAnonKey }
                });
                if (patternsRes.ok) {
                    const patternData = await patternsRes.json();
                    if (patternData.success) {
                        bettingPatterns = patternData.data;
                    }
                }
            } catch (err) {
                console.warn(`Failed to fetch mock data for ${playerId}`, err);
                debugLogs.push(`[Error] Failed to fetch external data for ${playerId}`);
            }

            // --- OPENAI INTEGRATION ---
            debugLogs.push(`[AI Request] Sending Player ${playerId} data to OpenAI for analysis...`);

            try {
                const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
                if (!openAIApiKey) throw new Error("Missing OPENAI_API_KEY");

                const systemPrompt = `You are a Senior Retention Specialist for a betting company. 
Score this lead (0-100) based on their potential value and reactivation probability.
Consider:
- LTV: High (>1M) is good.
- Product: 'casino' players are often stickier but higher risk; 'sports' are consistent.
- Patterns: specific betting styles.

Return strictly JSON: { "score": number, "reasoning": "short explanation" }`;

                const userPrompt = `Player Data:
- ID: ${playerId}
- Lifetime Value: ${lifetimeValue}
- Favorite Product: ${preferredProduct}
- Betting Patterns: ${JSON.stringify(bettingPatterns)}

Analyze and score this player.`;

                const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${openAIApiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini', // Fast & Cheap
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.3, // Deterministic
                        response_format: { type: "json_object" }
                    }),
                });

                if (!aiRes.ok) {
                    const errText = await aiRes.text();
                    throw new Error(`OpenAI Error: ${errText}`);
                }

                const aiData = await aiRes.json();
                const content = aiData.choices[0].message.content;
                const result = JSON.parse(content);

                const score = result.score || 0;
                const analysisNotes = `AI: ${result.reasoning} (LTV: ${lifetimeValue})`;

                debugLogs.push(`[AI Result] OpenAI Scored Player ${playerId}: ${score}/100. Reasoning: ${result.reasoning}`);

                // Update Lead
                const { error: updateError } = await supabaseClient
                    .from('leads')
                    .update({
                        lifetime_value: lifetimeValue,
                        preferred_product: preferredProduct,
                        lead_score: score,
                        betting_patterns: bettingPatterns,
                        analysis_notes: analysisNotes
                    })
                    .eq('id', lead.id);

                if (!updateError) processedCount++;

            } catch (aiErr: any) {
                console.error(`AI Analysis failed for ${playerId}`, aiErr);
                debugLogs.push(`[Error] OpenAI failed for ${playerId}: ${aiErr.message}`);
            }
        }));

        debugLogs.push(`[System] Batch complete. Analyzed ${processedCount} leads.`);

        return new Response(
            JSON.stringify({
                message: `Successfully analyzed ${processedCount} leads.`,
                processed: processedCount,
                logs: debugLogs
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Error in analyze-leads:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
