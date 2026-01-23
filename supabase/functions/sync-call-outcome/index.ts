import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallOutcomePayload {
    call_id: string;
    player_id: string;
    agent_id: string;
    call_date: string;
    outcome: string;
    disposition: string;
    notes?: string;
    promotion_offered?: string;
    promotion_accepted?: boolean;
    promised_deposit_amount?: number;
    callback_scheduled?: string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response("Method not allowed", {
            status: 405,
            headers: corsHeaders,
        });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error("Supabase environment variables not configured");
        }

        const bangbetApiBase = Deno.env.get("BANGBET_API_BASE");
        const bangbetApiKey = Deno.env.get("BANGBET_API_KEY");

        if (!bangbetApiBase || !bangbetApiKey) {
            console.warn("BangBet API not configured. Skipping sync.");
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "BangBet API not configured. Call outcome saved locally only.",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const payload: CallOutcomePayload = await req.json();

        // Validate required fields
        if (!payload.call_id || !payload.player_id || !payload.agent_id || !payload.outcome || !payload.disposition) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: "Missing required fields: call_id, player_id, agent_id, outcome, disposition",
                }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        console.log(`Syncing call outcome for player ${payload.player_id} to BangBet...`);

        // Send call outcome to BangBet API
        const bangbetResponse = await fetch(
            `${bangbetApiBase}/api/telemarketing/call-outcome`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${bangbetApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    player_id: payload.player_id,
                    agent_id: payload.agent_id,
                    call_date: payload.call_date,
                    outcome: payload.outcome,
                    disposition: payload.disposition,
                    notes: payload.notes,
                    promotion_offered: payload.promotion_offered,
                    promotion_accepted: payload.promotion_accepted,
                    promised_deposit_amount: payload.promised_deposit_amount,
                    callback_scheduled: payload.callback_scheduled,
                }),
            }
        );

        if (!bangbetResponse.ok) {
            const errorText = await bangbetResponse.text();
            console.error("BangBet API error:", bangbetResponse.status, errorText);

            // Update local record with failed sync status
            await fetch(
                `${supabaseUrl}/rest/v1/telemarketing_calls?id=eq.${payload.call_id}`,
                {
                    method: "PATCH",
                    headers: {
                        apiKey: supabaseServiceKey,
                        Authorization: `Bearer ${supabaseServiceKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        bangbet_sync_status: "failed",
                        bangbet_sync_at: new Date().toISOString(),
                    }),
                }
            );

            throw new Error(`Failed to sync to BangBet: ${bangbetResponse.status}`);
        }

        const bangbetData = await bangbetResponse.json();
        console.log("BangBet sync successful:", bangbetData);

        // Update local record with successful sync status
        const updateResponse = await fetch(
            `${supabaseUrl}/rest/v1/telemarketing_calls?id=eq.${payload.call_id}`,
            {
                method: "PATCH",
                headers: {
                    apiKey: supabaseServiceKey,
                    Authorization: `Bearer ${supabaseServiceKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    bangbet_sync_status: "synced",
                    bangbet_sync_at: new Date().toISOString(),
                }),
            }
        );

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error("Failed to update sync status:", errorText);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Call outcome synced to BangBet successfully",
                bangbet_outcome_id: bangbetData.data?.outcome_id,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error in sync-call-outcome function:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
