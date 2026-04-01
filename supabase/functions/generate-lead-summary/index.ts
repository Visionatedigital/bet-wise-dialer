import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { leadId, notes, disposition } = await req.json();

        if (!leadId || !notes) {
            return new Response(JSON.stringify({ error: "Missing leadId or notes" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openAIApiKey) {
            console.error("OPENAI_API_KEY not found in environment");
            return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`Generating summary for lead ${leadId} with notes: ${notes}`);

        // Call OpenAI to generate a short actionable summary
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${openAIApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an AI sales assistant for a betting platform. Your task is to take call notes from an agent and turn them into a very short, actionable plan for the next follow-up. Keep it under 15 words. Focus on what the customer promised or what the agent should do next. Example: 'Promised to deposit 50k tomorrow, follow up on Friday.' or 'Not interested now, check back in 3 months for World Cup.'",
                    },
                    {
                        role: "user",
                        content: `Disposition: ${disposition}\nNotes: ${notes}\n\nGenerate a short actionable summary for the agent.`,
                    },
                ],
                max_tokens: 60,
                temperature: 0.7,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenAI API error:", response.status, errorText);
            throw new Error(`OpenAI API failed: ${response.statusText}`);
        }

        const data = await response.json();
        const summary = data.choices[0].message.content.trim().replace(/^"|"$/g, '');

        console.log(`Generated summary: ${summary}`);

        // Update the lead in Supabase
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error: updateError } = await supabase
            .from("leads")
            .update({
                next_action: summary,
                last_activity: `${disposition.toUpperCase()}: ${notes}`
            })
            .eq("id", leadId);

        if (updateError) {
            console.error("Supabase update error:", updateError);
            throw updateError;
        }

        return new Response(JSON.stringify({ success: true, summary }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
