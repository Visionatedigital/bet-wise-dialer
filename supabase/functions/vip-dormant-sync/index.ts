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

    // Step 3: Create leads with AI Scoring
    const leads = await Promise.all(players.map(async (p: any) => {
      // Fetch full profile for LTV and patterns
      let lifetimeValue = 0;
      let depositCount = 0;
      let preferredProduct = "unknown";
      let bettingPatterns = {};

      try {
        // Fetch profile
        const profileRes = await fetch(`${mockApiUrl.replace(/\/segments\/.*$/, '')}/players/${p.player_id}/profile`, {
          headers: { "Authorization": `Bearer ${supabaseAnonKey}`, "apikey": supabaseAnonKey! }
        });
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData.success) {
            lifetimeValue = profileData.data.financial?.lifetime_value || 0;
            depositCount = profileData.data.financial?.total_deposits || 0;
            preferredProduct = profileData.data.preferences?.favorite_product || "unknown";
          }
        }

        // Fetch patterns
        const patternsRes = await fetch(`${mockApiUrl.replace(/\/segments\/.*$/, '')}/players/${p.player_id}/betting-patterns`, {
          headers: { "Authorization": `Bearer ${supabaseAnonKey}`, "apikey": supabaseAnonKey! }
        });
        if (patternsRes.ok) {
          const patternData = await patternsRes.json();
          if (patternData.success) {
            bettingPatterns = patternData.data;
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch details for player ${p.player_id}`, err);
      }

      // --- AI SCORING LOGIC ---
      // Base score on Lifetime Value (Proprietary Algorithm)
      // Cap LTV contribution at 80 points (assuming ~1M UGX is "high")
      let score = Math.min(Math.round((lifetimeValue / 1000000) * 80), 80);

      // Bonus for VIP level
      if (p.vip_level === 'platinum') score += 20;
      else if (p.vip_level === 'gold') score += 15;
      else if (p.vip_level === 'silver') score += 10;
      else score += 5;

      // Cap at 100
      score = Math.min(score, 100);

      const analysisNotes = `AI Analysis: LTV ${lifetimeValue.toLocaleString()} UGX. Preferred: ${preferredProduct}. Score: ${score}/100`;

      return {
        user_id: null,
        name: p.name || `Player ${p.player_id}`,
        phone: p.phone,
        segment: "vip",
        priority: "medium",
        score: 50, // Legacy score
        campaign: `VIP Dormant - ${new Date().toISOString().split('T')[0]}`,
        tags: ["vip_dormant"],
        intent: `Player ${p.player_id}`,
        // New AI Fields
        lifetime_value: lifetimeValue,
        deposit_count: depositCount,
        preferred_product: preferredProduct,
        lead_score: score,
        betting_patterns: bettingPatterns,
        analysis_notes: analysisNotes
      };
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
