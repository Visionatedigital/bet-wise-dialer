import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
            console.warn("BangBet API not configured. Skipping deposit verification.");
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "BangBet API not configured. Deposit verification skipped.",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log("Starting deposit verification process...");

        // Fetch calls from last 7 days with promised deposits that haven't been verified
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: callsToVerify, error: fetchError } = await fetch(
            `${supabaseUrl}/rest/v1/telemarketing_calls?disposition=eq.interested&promised_deposit_amount=not.is.null&deposit_verified_at=is.null&call_date=gte.${sevenDaysAgo.toISOString()}&select=id,player_id,agent_id,call_date,promised_deposit_amount`,
            {
                headers: {
                    apiKey: supabaseServiceKey,
                    Authorization: `Bearer ${supabaseServiceKey}`,
                    "Content-Type": "application/json",
                },
            }
        ).then(r => r.json());

        if (fetchError) {
            throw new Error(`Failed to fetch calls: ${JSON.stringify(fetchError)}`);
        }

        const calls = callsToVerify || [];
        console.log(`Found ${calls.length} calls to verify`);

        if (calls.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: "No calls to verify",
                    verified_count: 0,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let verifiedCount = 0;
        let totalDepositsFound = 0;

        // Process each call
        for (const call of calls) {
            try {
                // Fetch deposits for this player since the call date
                const depositResponse = await fetch(
                    `${bangbetApiBase}/api/players/${call.player_id}/deposits?since=${call.call_date}&limit=100`,
                    {
                        headers: {
                            Authorization: `Bearer ${bangbetApiKey}`,
                            "Content-Type": "application/json",
                        },
                    }
                );

                if (!depositResponse.ok) {
                    console.error(`Failed to fetch deposits for player ${call.player_id}`);
                    continue;
                }

                const depositData = await depositResponse.json();
                const deposits = depositData.data?.deposits || [];
                const totalDeposited = depositData.data?.total_deposited || 0;

                // Update the call record with actual deposit amount
                const updateResponse = await fetch(
                    `${supabaseUrl}/rest/v1/telemarketing_calls?id=eq.${call.id}`,
                    {
                        method: "PATCH",
                        headers: {
                            apiKey: supabaseServiceKey,
                            Authorization: `Bearer ${supabaseServiceKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            actual_deposit_amount: totalDeposited,
                            deposit_verified_at: new Date().toISOString(),
                        }),
                    }
                );

                if (updateResponse.ok) {
                    verifiedCount++;
                    if (totalDeposited > 0) {
                        totalDepositsFound++;
                    }
                    console.log(`Verified player ${call.player_id}: Promised ${call.promised_deposit_amount}, Actual ${totalDeposited}`);
                }
            } catch (error) {
                console.error(`Error processing call ${call.id}:`, error);
                continue;
            }
        }

        console.log(`Verification complete: ${verifiedCount} calls verified, ${totalDepositsFound} with deposits`);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Deposit verification completed",
                verified_count: verifiedCount,
                deposits_found: totalDepositsFound,
                conversion_rate: verifiedCount > 0 ? ((totalDepositsFound / verifiedCount) * 100).toFixed(1) : 0,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error in fetch-player-deposits function:", error);
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
