import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mock BangBet customer data for development
const mockCustomers = [
  {
    player_id: "UG001234",
    phone: "+256700123456",
    name: "John Kamau",
    vip_level: "gold",
    preferred_product: "aviator",
    language_preference: "english",
    timezone: "Africa/Kampala",
    last_login: "2026-01-05T14:30:00Z",
    last_deposit: "2026-01-03T10:15:00Z",
    total_deposits: 500000,
    currency: "UGX",
    days_inactive: 16,
    lifetime_value: 2500000,
    registration_date: "2025-06-10T08:00:00Z",
    current_balance: 50000,
    total_withdrawals: 350000,
    total_bets: 450,
    average_bet_size: 5000,
    marketing_consent: true
  },
  {
    player_id: "UG001235",
    phone: "+256700234567",
    name: "Sarah Nakato",
    vip_level: "silver",
    preferred_product: "casino",
    language_preference: "luganda",
    timezone: "Africa/Kampala",
    last_login: "2026-01-02T10:20:00Z",
    last_deposit: "2025-12-28T15:45:00Z",
    total_deposits: 300000,
    currency: "UGX",
    days_inactive: 19,
    lifetime_value: 1200000,
    registration_date: "2025-08-15T12:00:00Z",
    current_balance: 25000,
    total_withdrawals: 200000,
    total_bets: 280,
    average_bet_size: 3000,
    marketing_consent: true
  },
  {
    player_id: "UG001236",
    phone: "+256700345678",
    name: "David Okello",
    vip_level: "platinum",
    preferred_product: "sportsbook",
    language_preference: "english",
    timezone: "Africa/Kampala",
    last_login: "2026-01-08T18:15:00Z",
    last_deposit: "2026-01-07T09:30:00Z",
    total_deposits: 1500000,
    currency: "UGX",
    days_inactive: 13,
    lifetime_value: 5000000,
    registration_date: "2025-03-20T10:00:00Z",
    current_balance: 150000,
    total_withdrawals: 800000,
    total_bets: 1200,
    average_bet_size: 8000,
    marketing_consent: true
  },
  {
    player_id: "UG001237",
    phone: "+256700456789",
    name: "Grace Achieng",
    vip_level: "gold",
    preferred_product: "aviator",
    language_preference: "kiswahili",
    timezone: "Africa/Kampala",
    last_login: "2025-12-30T16:45:00Z",
    last_deposit: "2025-12-25T11:20:00Z",
    total_deposits: 600000,
    currency: "UGX",
    days_inactive: 22,
    lifetime_value: 2800000,
    registration_date: "2025-05-12T14:30:00Z",
    current_balance: 35000,
    total_withdrawals: 400000,
    total_bets: 520,
    average_bet_size: 6000,
    marketing_consent: true
  },
  {
    player_id: "UG001238",
    phone: "+256700567890",
    name: "Patrick Musoke",
    vip_level: "bronze",
    preferred_product: "casino",
    language_preference: "english",
    timezone: "Africa/Kampala",
    last_login: "2026-01-10T12:00:00Z",
    last_deposit: "2026-01-09T08:15:00Z",
    total_deposits: 150000,
    currency: "UGX",
    days_inactive: 11,
    lifetime_value: 450000,
    registration_date: "2025-11-05T09:00:00Z",
    current_balance: 18000,
    total_withdrawals: 80000,
    total_bets: 120,
    average_bet_size: 2500,
    marketing_consent: true
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // GET /api/telemarketing/segments/vip-dormant
    if (path.includes("/segments/vip-dormant")) {
      const minDaysInactive = parseInt(url.searchParams.get("min_days_inactive") || "14");
      const maxDaysInactive = parseInt(url.searchParams.get("max_days_inactive") || "30");
      const limit = parseInt(url.searchParams.get("limit") || "100");

      const vipDormant = mockCustomers.filter(c => 
        (c.vip_level === "gold" || c.vip_level === "platinum" || c.vip_level === "silver") &&
        c.days_inactive >= minDaysInactive &&
        c.days_inactive <= maxDaysInactive
      ).slice(0, limit);

      return new Response(
        JSON.stringify({
          success: true,
          total_count: vipDormant.length,
          players: vipDormant
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api/telemarketing/segments/casino-players
    if (path.includes("/segments/casino-players")) {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      
      const casinoPlayers = mockCustomers.filter(c => 
        c.preferred_product === "casino"
      ).slice(0, limit);

      return new Response(
        JSON.stringify({
          success: true,
          total_count: casinoPlayers.length,
          players: casinoPlayers
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api/telemarketing/segments/aviator-players
    if (path.includes("/segments/aviator-players")) {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      
      const aviatorPlayers = mockCustomers.filter(c => 
        c.preferred_product === "aviator"
      ).slice(0, limit);

      return new Response(
        JSON.stringify({
          success: true,
          total_count: aviatorPlayers.length,
          players: aviatorPlayers
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api/customers/{player_id}
    const customerMatch = path.match(/\/customers\/([^\/]+)$/);
    if (customerMatch && req.method === "GET") {
      const playerId = customerMatch[1];
      const customer = mockCustomers.find(c => c.player_id === playerId);

      if (!customer) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Customer not found",
              details: `No customer exists with ID: ${playerId}`
            }
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          customer: {
            ...customer,
            vip_status: {
              level: customer.vip_level,
              points: customer.vip_level === "platinum" ? 30000 : customer.vip_level === "gold" ? 15000 : 5000,
              next_level_points: customer.vip_level === "platinum" ? 50000 : customer.vip_level === "gold" ? 25000 : 15000
            },
            activity: {
              last_login: customer.last_login,
              last_bet: customer.last_deposit,
              last_deposit: customer.last_deposit,
              days_since_last_activity: customer.days_inactive
            },
            preferences: {
              favorite_games: [customer.preferred_product],
              preferred_language: customer.language_preference,
              timezone: customer.timezone,
              marketing_consent: customer.marketing_consent
            },
            financial: {
              current_balance: customer.current_balance,
              total_deposits: customer.total_deposits,
              total_withdrawals: customer.total_withdrawals,
              lifetime_value: customer.lifetime_value,
              currency: customer.currency
            },
            betting_behavior: {
              total_bets: customer.total_bets,
              average_bet_size: customer.average_bet_size,
              favorite_sport: "football",
              preferred_bet_type: "single"
            }
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api/customers/search
    if (path.includes("/customers/search")) {
      const phone = url.searchParams.get("phone");
      const playerId = url.searchParams.get("player_id");
      const name = url.searchParams.get("name");

      let results = mockCustomers;

      if (phone) {
        const cleanPhone = phone.replace(/[^\d+]/g, "");
        results = results.filter(c => c.phone.includes(cleanPhone));
      }

      if (playerId) {
        results = results.filter(c => c.player_id === playerId);
      }

      if (name) {
        results = results.filter(c => 
          c.name.toLowerCase().includes(name.toLowerCase())
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          results: results.map(c => ({
            player_id: c.player_id,
            phone: c.phone,
            name: c.name,
            vip_level: c.vip_level,
            last_activity: c.last_login
          }))
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /api/customers/{player_id}/notes
    const notesMatch = path.match(/\/customers\/([^\/]+)\/notes$/);
    if (notesMatch && req.method === "POST") {
      const playerId = notesMatch[1];
      const customer = mockCustomers.find(c => c.player_id === playerId);

      if (!customer) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Customer not found"
            }
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      const body = await req.json();
      console.log(`[Mock BangBet] Note added for ${playerId}:`, body.note);

      return new Response(
        JSON.stringify({
          success: true,
          note_id: `note_${Date.now()}`,
          created_at: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default 404
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Endpoint not found",
          details: `Path ${path} not recognized`
        }
      }),
      { 
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("Error in mock-bangbet-api:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error"
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
