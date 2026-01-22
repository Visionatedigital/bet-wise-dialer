import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VipDormantPlayer {
  player_id: string;
  phone: string;
  name?: string;
  vip_level?: string;
  preferred_product?: string;
  language_preference?: string;
  timezone?: string;
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
      throw new Error(
        "Bangbet integration not configured. Set BANGBET_API_BASE and BANGBET_API_KEY."
      );
    }

    // 1) Fetch VIP Dormant players from Bangbet integration API
    const vipResponse = await fetch(
      `${bangbetApiBase}/api/telemarketing/segments/vip-dormant`,
      {
        headers: {
          Authorization: `Bearer ${bangbetApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!vipResponse.ok) {
      const text = await vipResponse.text();
      console.error("Bangbet VIP dormant API error:", vipResponse.status, text);
      throw new Error("Failed to fetch VIP dormant segment from Bangbet");
    }

    const vipData = await vipResponse.json();
    const players: VipDormantPlayer[] = vipData.players ?? [];

    console.log(`Fetched ${players.length} VIP dormant players from Bangbet`);

    if (!players.length) {
      return new Response(
        JSON.stringify({ message: "No VIP dormant players to sync" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Upsert a VIP_DORMANT campaign
    const campaignCode = "VIP_DORMANT";

    const upsertCampaignRes = await fetch(
      `${supabaseUrl}/rest/v1/telemarketing_campaigns`,
      {
        method: "POST",
        headers: {
          apiKey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify([
          {
            code: campaignCode,
            name: "VIP Dormant Reactivation",
            description:
              "Reactivation campaign for VIP players inactive for 14–30 days",
            is_active: true,
          },
        ]),
      }
    );

    if (!upsertCampaignRes.ok) {
      const text = await upsertCampaignRes.text();
      console.error("Failed to upsert campaign:", text);
      throw new Error("Failed to upsert telemarketing campaign");
    }

    // Fetch campaign row to get its id
    const campaignFetch = await fetch(
      `${supabaseUrl}/rest/v1/telemarketing_campaigns?code=eq.${campaignCode}&limit=1`,
      {
        headers: {
          apiKey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!campaignFetch.ok) {
      const text = await campaignFetch.text();
      console.error("Failed to fetch campaign:", text);
      throw new Error("Failed to fetch telemarketing campaign");
    }

    const campaignRows = await campaignFetch.json();
    const campaign = campaignRows[0];

    if (!campaign?.id) {
      throw new Error("Campaign not found after upsert");
    }

    const campaignId = campaign.id as string;

    // 3) For each player, fetch full details and generate personalized script
    console.log(`Fetching detailed customer data and generating scripts...`);

    const leadsWithScripts = await Promise.all(
      players.map(async (p) => {
        try {
          // Fetch full customer details from BangBet
          const customerResponse = await fetch(
            `${bangbetApiBase}/api/customers/${p.player_id}`,
            {
              headers: {
                Authorization: `Bearer ${bangbetApiKey}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!customerResponse.ok) {
            console.error(`Failed to fetch customer ${p.player_id}`);
            return {
              campaign_id: campaignId,
              player_id: p.player_id,
              phone: p.phone,
              player_name: p.name ?? null,
              vip_level: p.vip_level ?? null,
              preferred_product: p.preferred_product ?? null,
              language_preference: p.language_preference ?? null,
              timezone: p.timezone ?? null,
              status: "new",
              personalized_script: null,
              betting_habits: null,
            };
          }

          const customerData = await customerResponse.json();
          const customer = customerData.customer;

          // Generate personalized call script
          const scriptResponse = await fetch(
            `${supabaseUrl}/functions/v1/generate-call-script`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                customerData: customer,
                campaignType: campaignCode,
              }),
            }
          );

          let script = null;
          if (scriptResponse.ok) {
            const scriptData = await scriptResponse.json();
            script = scriptData.script;
            console.log(`Generated script for ${p.player_id}`);
          } else {
            console.error(`Failed to generate script for ${p.player_id}`);
          }

          // Extract key betting habits for quick reference
          const bettingHabits = {
            favorite_sport: customer.betting_behavior?.favorite_sport,
            favorite_teams: customer.betting_behavior?.favorite_teams,
            casino_favorite: customer.betting_behavior?.casino_favorite,
            vip_level: customer.vip_status?.level,
            days_inactive: customer.activity?.days_since_last_activity,
            lifetime_value: customer.financial?.lifetime_value,
          };

          return {
            campaign_id: campaignId,
            player_id: p.player_id,
            phone: p.phone,
            player_name: p.name ?? null,
            vip_level: p.vip_level ?? null,
            preferred_product: p.preferred_product ?? null,
            language_preference: p.language_preference ?? null,
            timezone: p.timezone ?? null,
            status: "new",
            personalized_script: script,
            betting_habits: bettingHabits,
          };
        } catch (error) {
          console.error(`Error processing player ${p.player_id}:`, error);
          return {
            campaign_id: campaignId,
            player_id: p.player_id,
            phone: p.phone,
            player_name: p.name ?? null,
            vip_level: p.vip_level ?? null,
            preferred_product: p.preferred_product ?? null,
            language_preference: p.language_preference ?? null,
            timezone: p.timezone ?? null,
            status: "new",
            personalized_script: null,
            betting_habits: null,
          };
        }
      })
    );

    // 4) Upsert leads with personalized scripts
    const upsertLeadsRes = await fetch(
      `${supabaseUrl}/rest/v1/telemarketing_leads`,
      {
        method: "POST",
        headers: {
          apiKey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(leadsWithScripts),
      }
    );

    if (!upsertLeadsRes.ok) {
      const text = await upsertLeadsRes.text();
      console.error("Failed to upsert telemarketing leads:", text);
      throw new Error("Failed to upsert telemarketing leads");
    }

    console.log(`Successfully synced ${players.length} leads with personalized scripts`);

    return new Response(
      JSON.stringify({
        message: "VIP Dormant sync completed with personalized scripts",
        players_synced: players.length,
        scripts_generated: leadsWithScripts.filter(l => l.personalized_script).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in vip-dormant-sync function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

