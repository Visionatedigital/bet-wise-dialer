import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AI Call Analysis Service
 * Analyzes call transcripts and generates:
 * - Script adherence score
 * - Engagement score
 * - Conversion likelihood
 * - Detected objections
 * - Improvement suggestions
 */

interface AnalysisRequest {
    callId: string;
    transcript: string;
    language?: string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { callId, transcript, language }: AnalysisRequest = await req.json();

        if (!callId || !transcript) {
            throw new Error("callId and transcript are required");
        }

        console.log(`[AI Analysis] Analyzing call ${callId}, language: ${language || 'en'}`);

        const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openAIApiKey) {
            throw new Error("OpenAI API key not configured");
        }

        // Call OpenAI to analyze the transcript
        const analysisPrompt = `You are an expert call quality analyst for a sports betting telemarketing campaign in Uganda (BangBet). 

Analyze this call transcript and provide detailed feedback:

TRANSCRIPT:
${transcript}

Provide a JSON response with the following structure:
{
  "script_adherence_score": <0-100, how well agent followed best practices>,
  "engagement_score": <0-100, customer engagement level>,
  "conversion_likelihood": <0-100, likelihood customer will convert>,
  "detected_objections": [
    {
      "type": "price|time|interest|trust|other",
      "text": "exact objection from transcript",
      "timestamp": "approximate time in call",
      "handled_well": true/false
    }
  ],
  "improvements": [
    {
      "category": "opening|rapport|objection_handling|closing|product_knowledge|tone",
      "issue": "what went wrong",
      "suggestion": "specific actionable improvement",
      "priority": "high|medium|low"
    }
  ],
  "strengths": ["list of things agent did well"],
  "key_moments": [
    {
      "time": "approximate timestamp",
      "type": "objection|interest|close_attempt|information|callback",
      "description": "what happened"
    }
  ],
  "overall_summary": "2-3 sentence summary of call quality",
  "recommended_action": "follow_up|no_action|escalate|do_not_call"
}

Focus on:
1. Cultural appropriateness for Ugandan market
2. Product knowledge about sports betting/casino/aviator
3. Objection handling techniques
4. Building trust and rapport
5. Clear call-to-action`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openAIApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert telemarketing call analyst. Respond only with valid JSON."
                    },
                    {
                        role: "user",
                        content: analysisPrompt
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const analysisText = data.choices[0].message.content;
        const analysis = JSON.parse(analysisText);

        console.log("[AI Analysis] Analysis complete");
        console.log("[AI Analysis] Scores - Script:", analysis.script_adherence_score,
            "Engagement:", analysis.engagement_score,
            "Conversion:", analysis.conversion_likelihood);

        // Save analysis to database
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error: insertError } = await supabase
            .from("telemarketing_call_feedback")
            .insert({
                call_id: callId,
                script_adherence_score: analysis.script_adherence_score,
                engagement_score: analysis.engagement_score,
                conversion_likelihood: analysis.conversion_likelihood,
                detected_objections: analysis.detected_objections || [],
                improvements: analysis.improvements || [],
                raw_analysis: analysis
            });

        if (insertError) {
            console.error("[AI Analysis] Error saving feedback:", insertError);
            throw new Error(`Failed to save feedback: ${insertError.message}`);
        }

        console.log("[AI Analysis] Feedback saved to database");

        return new Response(
            JSON.stringify({
                success: true,
                analysis: analysis
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[AI Analysis] Error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
