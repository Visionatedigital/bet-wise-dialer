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
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

        // Initialize Supabase Client with Service Key (Admin rights)
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const bangbetApiBase = Deno.env.get("BANGBET_API_BASE");
        const bangbetApiKey = Deno.env.get("BANGBET_API_KEY");

        if (!bangbetApiBase || !bangbetApiKey) {
            console.warn("BangBet API not configured. Using Mock Data generation.");
            // In a real scenario, we might return or throw, but for this demo/mock setup we'll simulate.
        }

        console.log("Starting daily sync process...");

        // 1. Fetch 'stale' leads (not updated in 24h)
        // We use a small batch size to avoid timeouts
        const BATCH_SIZE = 50;
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Query leads where last_data_sync is NULL or older than 24h
        // Note: 'last_data_sync' column needs to exist.
        const { data: leads, error: fetchError } = await supabase
            .from('leads')
            .select('id, phone, player_id')
            .or(`last_data_sync.is.null,last_data_sync.lt.${twentyFourHoursAgo}`)
            .order('last_data_sync', { ascending: true, nullsFirst: true })
            .limit(BATCH_SIZE);

        if (fetchError) throw fetchError;

        if (!leads || leads.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: "All leads up to date", count: 0 }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`Processing batch of ${leads.length} stale leads...`);
        let updatedCount = 0;

        // 2. Process batch
        for (const lead of leads) {
            // Simulate fetching from Bangbet (or use real API if configured)
            // For this implementation, we'll try to use the real API if env vars exist, else mock.

            let stats = {
                last_deposit_ugx: 0,
                last_activity: new Date().toISOString(),
                preferred_product: 'unknown'
            };

            if (bangbetApiBase && bangbetApiKey && lead.player_id) {
                try {
                    const res = await fetch(`${bangbetApiBase}/api/players/${lead.player_id}/activity-summary`, {
                        headers: { 'Authorization': `Bearer ${bangbetApiKey}` }
                    });
                    if (res.ok) {
                        const json = await res.json();
                        if (json.data) {
                            stats.last_deposit_ugx = json.data.total_deposited_lifetime || 0; // Or fetch deposits endpoint separately
                            stats.last_activity = json.data.last_active_at || new Date().toISOString();
                            stats.preferred_product = json.data.favorite_product || 'unknown';
                        }
                    }
                } catch (e) {
                    console.error(`Failed to fetch for ${lead.phone}`, e);
                }
            } else {
                // MOCK LOGIC for demo (random updates to show "life")
                // Only apply random stats if we are fully mocking
                if (Math.random() > 0.7) { // 30% chance of new activity
                    stats.last_activity = new Date().toISOString();
                    stats.last_deposit_ugx = Math.floor(Math.random() * 50000);
                    const products = ['sports', 'casino', 'virtual', 'aviator'];
                    stats.preferred_product = products[Math.floor(Math.random() * products.length)];
                } else {
                    // Keeps existing/old date effectively, but we update 'last_data_sync'
                    // to prevent re-processing immediately.
                }
            }

            // 3. Update Lead
            const { error: updateError } = await supabase
                .from('leads')
                .update({
                    last_data_sync: new Date().toISOString(), // Critical: Mark as synced
                    ...(stats.last_deposit_ugx > 0 ? { last_deposit_ugx: stats.last_deposit_ugx } : {}),
                    ...(stats.preferred_product !== 'unknown' ? { preferred_product: stats.preferred_product } : {}),
                    // Only update last_activity if we actually got a new date (in mock logic, we might not)
                    // But here we'll just assume the sync itself confirms the 'latest known state'
                })
                .eq('id', lead.id);

            if (!updateError) {
                updatedCount++;
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Synced ${updatedCount} leads`,
                remaining: leads.length - updatedCount
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Sync error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
