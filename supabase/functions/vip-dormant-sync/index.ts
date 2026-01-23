import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Get request body
    let limit = 2000; // Increased to allow all 1022 leads
    try {
      const body = await req.json();
      limit = body.limit || 2000;
    } catch (e) {
      // No body
    }

    console.log(`Requesting ${limit} leads`);

    // Step 1: Fetch from mock API with proper auth
    const mockApiUrl = `${supabaseUrl}/functions/v1/mock-bangbet-api/api/telemarketing/segments/vip-dormant`;

    const mockResponse = await fetch(mockApiUrl, {
      headers: {
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "apikey": supabaseAnonKey!,
      },
    });

    if (!mockResponse.ok) {
      const errorText = await mockResponse.text();
      throw new Error(`Mock API failed: ${mockResponse.status} - ${errorText}`);
    }

    const mockData = await mockResponse.json();
    const allPlayers = mockData.players || [];
    const players = allPlayers.slice(0, limit);

    console.log(`Got ${players.length} players`);

    if (players.length === 0) {
      return new Response(
        JSON.stringify({ message: "No players available", players_synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get user ID
    const profilesResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?role=eq.admin&limit=1`,
      {
        headers: {
          "apikey": supabaseServiceKey!,
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
      }
    );

    if (!profilesResponse.ok) {
      throw new Error(`Failed to get user: ${profilesResponse.status}`);
    }

    const userRoles = await profilesResponse.json();
    const userId = userRoles[0]?.user_id;

    if (!userId) {
      throw new Error("No admin user found");
    }

    // Step 3: Create leads (with user_id = null so they can be distributed)
    const leads = players.map((p: any) => ({
      user_id: null, // NULL so distribute-leads can assign to agents
      name: p.name || `Player ${p.player_id}`,
      phone: p.phone,
      segment: "vip",
      priority: "medium",
      score: 50,
      campaign: `VIP Dormant - ${new Date().toISOString().split('T')[0]}`,
      tags: ["vip_dormant"],
      intent: `Player ${p.player_id}`,
    }));

    // Step 4: Insert leads
    const insertResponse = await fetch(
      `${supabaseUrl}/rest/v1/leads`,
      {
        method: "POST",
        headers: {
          "apikey": supabaseServiceKey!,
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify(leads),
      }
    );

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      throw new Error(`Insert failed: ${insertResponse.status} - ${errorText}`);
    }

    const inserted = await insertResponse.json();
    console.log(`Inserted ${inserted.length} leads`);

    return new Response(
      JSON.stringify({
        message: `Successfully imported ${inserted.length} leads from BangBet`,
        players_synced: inserted.length,
        total_available: allPlayers.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
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
