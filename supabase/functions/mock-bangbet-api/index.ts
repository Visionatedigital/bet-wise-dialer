import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { mockPlayers, mockBettingPatterns, mockPromotions } from "./seed-data.ts";
import type { Player, CallEligibility, PromotionAssignment, CallOutcome, ApiResponse } from "./types.ts";
import {
  mockState,
  resetMockState,
  setScenario,
  checkRateLimit,
  shouldReturnError,
  simulateDelay,
  validateApiKey,
  scenarios
} from "./scenarios.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mock-scenario, x-supabase-client-platform",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const authHeader = req.headers.get("Authorization");
    const apikeyHeader = req.headers.get("apikey");
    const scenarioHeader = req.headers.get("X-Mock-Scenario");

    // Apply scenario from header if provided
    if (scenarioHeader && scenarios[scenarioHeader as keyof typeof scenarios]) {
      setScenario(scenarioHeader);
    }

    // Simulate delay if configured
    await simulateDelay();

    // Check authentication (except for admin endpoints)
    if (!path.includes("/__admin/")) {
      if (!validateApiKey(authHeader, apikeyHeader)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Invalid or missing API key",
              details: "Please provide a valid API key in the Authorization header"
            }
          } as ApiResponse<never>),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      // Check rate limit
      if (!checkRateLimit()) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many requests",
              details: `Rate limit exceeded. Try again after ${new Date(mockState.rateLimitReset).toISOString()}`
            }
          } as ApiResponse<never>),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "X-RateLimit-Limit": "10",
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": mockState.rateLimitReset.toString()
            }
          }
        );
      }

      // Simulate random errors if configured
      if (shouldReturnError()) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: "Internal server error",
              details: "An unexpected error occurred. Please try again later."
            }
          } as ApiResponse<never>),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    // ========== ADMIN ENDPOINTS ==========

    // POST /__admin/scenario - Set active scenario
    if (path.includes("/__admin/scenario") && req.method === "POST") {
      const body = await req.json();
      const success = setScenario(body.scenario);

      if (!success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "INVALID_SCENARIO",
              message: "Invalid scenario name",
              details: `Available scenarios: ${Object.keys(scenarios).join(", ")}`
            }
          } as ApiResponse<never>),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            scenario: mockState.scenario,
            message: `Scenario set to: ${mockState.scenario}`
          }
        } as ApiResponse<{ scenario: string; message: string }>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /__admin/reset - Reset mock state
    if (path.includes("/__admin/reset") && req.method === "POST") {
      resetMockState();

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            message: "Mock state reset to defaults"
          }
        } as ApiResponse<{ message: string }>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /__admin/status - Get current mock state
    if (path.includes("/__admin/status") && req.method === "GET") {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            scenario: mockState.scenario,
            rateLimitCount: mockState.rateLimitCount,
            rateLimitReset: new Date(mockState.rateLimitReset).toISOString(),
            assignedPromotions: mockState.assignedPromotions.length,
            callOutcomes: mockState.callOutcomes.length,
            availableScenarios: Object.keys(scenarios)
          }
        } as ApiResponse<any>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== PLAYER ENDPOINTS ==========

    // GET /api/players/{id}/profile - Full player profile
    const profileMatch = path.match(/\/api\/players\/([^\/]+)\/profile$/);
    if (profileMatch && req.method === "GET") {
      const playerId = profileMatch[1];
      const player = mockPlayers.find(p => p.player_id === playerId);

      if (!player) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Player not found",
              details: `No player exists with ID: ${playerId}`
            }
          } as ApiResponse<never>),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...player,
            vip_status: {
              level: player.vip_level,
              points: player.vip_level === "platinum" ? 30000 : player.vip_level === "gold" ? 15000 : player.vip_level === "silver" ? 5000 : 1000,
              next_level_points: player.vip_level === "platinum" ? 50000 : player.vip_level === "gold" ? 25000 : player.vip_level === "silver" ? 15000 : 5000
            },
            activity: {
              last_login: player.last_login,
              last_deposit: player.last_deposit,
              days_since_last_activity: player.days_inactive
            },
            preferences: {
              favorite_product: player.preferred_product,
              preferred_language: player.language_preference,
              timezone: player.timezone,
              marketing_consent: player.marketing_consent
            },
            financial: {
              current_balance: player.current_balance,
              total_deposits: player.total_deposits,
              total_withdrawals: player.total_withdrawals,
              lifetime_value: player.lifetime_value,
              currency: player.currency
            }
          }
        } as ApiResponse<any>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api/players/{id}/betting-patterns - Detailed betting behavior
    const patternsMatch = path.match(/\/api\/players\/([^\/]+)\/betting-patterns$/);
    if (patternsMatch && req.method === "GET") {
      const playerId = patternsMatch[1];
      const patterns = mockBettingPatterns[playerId];

      if (!patterns) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Betting patterns not found",
              details: `No betting patterns exist for player ID: ${playerId}`
            }
          } as ApiResponse<never>),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: patterns
        } as ApiResponse<typeof patterns>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api/players/{id}/call-eligibility - Call permission check
    const eligibilityMatch = path.match(/\/api\/players\/([^\/]+)\/call-eligibility$/);
    if (eligibilityMatch && req.method === "GET") {
      const playerId = eligibilityMatch[1];
      const player = mockPlayers.find(p => p.player_id === playerId);

      if (!player) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Player not found",
              details: `No player exists with ID: ${playerId}`
            }
          } as ApiResponse<never>),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      // Check eligibility
      const restrictions = {
        self_excluded: player.account_status === "self_excluded",
        do_not_call: player.account_status === "do_not_call",
        outside_call_window: false, // Could implement time-based logic here
        recent_call: false // Could check call outcomes
      };

      const call_allowed = !restrictions.self_excluded && !restrictions.do_not_call;
      let reason: string | undefined;

      if (restrictions.self_excluded) {
        reason = "Player is self-excluded";
      } else if (restrictions.do_not_call) {
        reason = "Player is on do-not-call list";
      }

      const eligibility: CallEligibility = {
        player_id: playerId,
        call_allowed,
        reason,
        restrictions
      };

      return new Response(
        JSON.stringify({
          success: true,
          data: eligibility
        } as ApiResponse<CallEligibility>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== TELEMARKETING ENDPOINTS ==========

    // GET /api/telemarketing/segments/vip-dormant - For vip-dormant-sync compatibility
    if (path.includes("/api/telemarketing/segments/vip-dormant") && req.method === "GET") {
      const vipDormantPlayers = mockPlayers.filter(p =>
        (p.vip_level === "gold" || p.vip_level === "platinum" || p.vip_level === "silver") &&
        p.days_inactive >= 14 &&
        p.days_inactive <= 30 &&
        p.account_status === "active"
      );

      return new Response(
        JSON.stringify({
          success: true,
          players: vipDormantPlayers.map(p => ({
            player_id: p.player_id,
            phone: p.phone,
            name: p.name,
            vip_level: p.vip_level,
            preferred_product: p.preferred_product,
            language_preference: p.language_preference,
            timezone: p.timezone
          }))
        } as ApiResponse<any>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api/players?segment={name} - Segmentation lists
    if (path.includes("/api/players") && req.method === "GET") {
      const segment = url.searchParams.get("segment");
      const limit = parseInt(url.searchParams.get("limit") || "100");

      if (!segment) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "MISSING_PARAMETER",
              message: "Missing required parameter: segment"
            }
          } as ApiResponse<never>),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      let filteredPlayers: Player[] = [];

      // Segment logic
      switch (segment) {
        case "vip_dormant":
          filteredPlayers = mockPlayers.filter(p =>
            (p.vip_level === "gold" || p.vip_level === "platinum" || p.vip_level === "silver") &&
            p.days_inactive >= 14 &&
            p.days_inactive <= 30 &&
            p.account_status === "active"
          );
          break;
        case "aviator_only":
          filteredPlayers = mockPlayers.filter(p => {
            const patterns = mockBettingPatterns[p.player_id];
            return patterns && patterns.aviator.active && !patterns.casino.active && !patterns.sportsbook.active;
          });
          break;
        case "casino_only":
          filteredPlayers = mockPlayers.filter(p => {
            const patterns = mockBettingPatterns[p.player_id];
            return patterns && patterns.casino.active && !patterns.aviator.active && !patterns.sportsbook.active;
          });
          break;
        case "sportsbook_only":
          filteredPlayers = mockPlayers.filter(p => {
            const patterns = mockBettingPatterns[p.player_id];
            return patterns && patterns.sportsbook.active && !patterns.aviator.active && !patterns.casino.active;
          });
          break;
        case "inactive_14_days":
          filteredPlayers = mockPlayers.filter(p => p.days_inactive >= 14 && p.account_status === "active");
          break;
        case "low_balance":
          filteredPlayers = mockPlayers.filter(p => p.current_balance < 10000 && p.account_status === "active");
          break;
        case "high_value":
          filteredPlayers = mockPlayers.filter(p => p.lifetime_value > 2000000);
          break;
        default:
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "INVALID_SEGMENT",
                message: "Invalid segment name",
                details: `Available segments: vip_dormant, aviator_only, casino_only, sportsbook_only, inactive_14_days, low_balance, high_value`
              }
            } as ApiResponse<never>),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
          );
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            segment,
            total_count: filteredPlayers.length,
            players: filteredPlayers.slice(0, limit)
          }
        } as ApiResponse<{ segment: string; total_count: number; players: Player[] }>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== PROMOTIONS ENDPOINTS ==========

    // GET /api/promotions/eligible - Get eligible promotions for a player
    if (path.includes("/api/promotions/eligible") && req.method === "GET") {
      const playerId = url.searchParams.get("player_id");

      if (!playerId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "MISSING_PARAMETER",
              message: "Missing required parameter: player_id"
            }
          } as ApiResponse<never>),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      const player = mockPlayers.find(p => p.player_id === playerId);

      if (!player) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Player not found"
            }
          } as ApiResponse<never>),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      // Filter eligible promotions
      const eligiblePromotions = mockPromotions.filter(promo => {
        const criteria = promo.eligibility_criteria;

        // Check VIP level
        if (criteria.min_vip_level) {
          const vipLevels = ["bronze", "silver", "gold", "platinum"];
          const playerLevel = vipLevels.indexOf(player.vip_level);
          const minLevel = vipLevels.indexOf(criteria.min_vip_level);
          if (playerLevel < minLevel) return false;
        }

        // Check deposits
        if (criteria.min_deposits !== undefined && player.total_deposits < criteria.min_deposits) {
          return false;
        }

        // Check inactive days
        if (criteria.min_inactive_days !== undefined && player.days_inactive < criteria.min_inactive_days) {
          return false;
        }
        if (criteria.max_inactive_days !== undefined && player.days_inactive > criteria.max_inactive_days) {
          return false;
        }

        // Check product match
        if (promo.product !== "all" && promo.product !== player.preferred_product) {
          return false;
        }

        return true;
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            player_id: playerId,
            eligible_promotions: eligiblePromotions
          }
        } as ApiResponse<any>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /api/promotions/assign - Assign promotion to player
    if (path.includes("/api/promotions/assign") && req.method === "POST") {
      const body = await req.json();
      const { player_id, promotion_id, assigned_by } = body;

      if (!player_id || !promotion_id || !assigned_by) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "MISSING_PARAMETERS",
              message: "Missing required parameters: player_id, promotion_id, assigned_by"
            }
          } as ApiResponse<never>),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      const assignment: PromotionAssignment = {
        assignment_id: `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        player_id,
        promotion_id,
        assigned_at: new Date().toISOString(),
        assigned_by,
        status: "pending"
      };

      mockState.assignedPromotions.push(assignment);

      return new Response(
        JSON.stringify({
          success: true,
          data: assignment
        } as ApiResponse<PromotionAssignment>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /api/telemarketing/call-outcome - Record call outcome
    if (path.includes("/api/telemarketing/call-outcome") && req.method === "POST") {
      const body = await req.json();
      const { player_id, agent_id, outcome, disposition, notes, promotion_offered, promotion_accepted, callback_scheduled } = body;

      if (!player_id || !agent_id || !outcome || !disposition) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "MISSING_PARAMETERS",
              message: "Missing required parameters: player_id, agent_id, outcome, disposition"
            }
          } as ApiResponse<never>),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      const callOutcome: CallOutcome = {
        outcome_id: `outcome_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        player_id,
        agent_id,
        call_date: new Date().toISOString(),
        outcome,
        disposition,
        notes,
        promotion_offered,
        promotion_accepted,
        callback_scheduled
      };

      mockState.callOutcomes.push(callOutcome);

      return new Response(
        JSON.stringify({
          success: true,
          data: callOutcome
        } as ApiResponse<CallOutcome>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== DEPOSIT TRACKING ENDPOINTS ==========

    // GET /api/players/{id}/deposits - Get deposit history since a date
    const depositsMatch = path.match(/\/api\/players\/([^\/]+)\/deposits$/);
    if (depositsMatch && req.method === "GET") {
      const playerId = depositsMatch[1];
      const player = mockPlayers.find(p => p.player_id === playerId);

      if (!player) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Player not found"
            }
          } as ApiResponse<never>),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      const since = url.searchParams.get("since");
      const limit = parseInt(url.searchParams.get("limit") || "100");

      // Simulate deposits - in real implementation, this would query actual deposit records
      // For now, generate mock deposits based on call outcomes
      const relevantOutcomes = mockState.callOutcomes.filter(o =>
        o.player_id === playerId &&
        o.disposition === "interested" &&
        o.promised_deposit_amount
      );

      const deposits = relevantOutcomes.map((outcome, index) => {
        const depositDate = new Date(outcome.call_date);
        depositDate.setDate(depositDate.getDate() + Math.floor(Math.random() * 3) + 1); // 1-3 days after call

        return {
          deposit_id: `dep_${Date.now()}_${index}`,
          player_id: playerId,
          amount: outcome.promised_deposit_amount! * (0.8 + Math.random() * 0.4), // 80-120% of promised
          currency: "UGX",
          deposit_date: depositDate.toISOString(),
          method: "mobile_money" as const,
          status: "completed" as const
        };
      });

      // Filter by since date if provided
      let filteredDeposits = deposits;
      if (since) {
        const sinceDate = new Date(since);
        filteredDeposits = deposits.filter(d => new Date(d.deposit_date) >= sinceDate);
      }

      const limitedDeposits = filteredDeposits.slice(0, limit);
      const totalDeposited = limitedDeposits.reduce((sum, d) => sum + d.amount, 0);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            player_id: playerId,
            deposits: limitedDeposits,
            total_deposited: totalDeposited,
            deposit_count: limitedDeposits.length
          }
        } as ApiResponse<any>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /api/players/{id}/activity-summary - Get activity summary after a call
    const activityMatch = path.match(/\/api\/players\/([^\/]+)\/activity-summary$/);
    if (activityMatch && req.method === "GET") {
      const playerId = activityMatch[1];
      const player = mockPlayers.find(p => p.player_id === playerId);

      if (!player) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "NOT_FOUND",
              message: "Player not found"
            }
          } as ApiResponse<never>),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }

      const since = url.searchParams.get("since");
      const patterns = mockBettingPatterns[playerId];

      // Calculate activity since the call
      const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Simulate activity based on call outcomes
      const relevantOutcomes = mockState.callOutcomes.filter(o =>
        o.player_id === playerId &&
        new Date(o.call_date) >= sinceDate
      );

      const hasPositiveOutcome = relevantOutcomes.some(o => o.disposition === "interested");

      // Simulate deposits
      const totalDepositsSince = hasPositiveOutcome ?
        relevantOutcomes.reduce((sum, o) => sum + (o.promised_deposit_amount || 0), 0) * 0.9 : 0;

      const depositCountSince = hasPositiveOutcome ? relevantOutcomes.filter(o => o.promised_deposit_amount).length : 0;

      // Simulate betting activity
      const totalBetsSince = hasPositiveOutcome ? Math.floor(Math.random() * 10) + 1 : 0;
      const totalWageredSince = totalBetsSince * player.average_bet_size;

      const productsUsed: string[] = [];
      if (patterns) {
        if (patterns.casino.active) productsUsed.push("casino");
        if (patterns.sportsbook.active) productsUsed.push("sportsbook");
        if (patterns.aviator.active) productsUsed.push("aviator");
      }

      const activitySummary = {
        player_id: playerId,
        last_login: hasPositiveOutcome ? new Date().toISOString() : player.last_login,
        total_deposits_since: totalDepositsSince,
        deposit_count_since: depositCountSince,
        total_bets_since: totalBetsSince,
        total_wagered_since: totalWageredSince,
        products_used: productsUsed,
        active_since_call: hasPositiveOutcome
      };

      return new Response(
        JSON.stringify({
          success: true,
          data: activitySummary
        } as ApiResponse<any>),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== LEGACY ENDPOINTS (for backward compatibility) ==========

    // GET /api/telemarketing/segments/vip-dormant
    if (path.includes("/segments/vip-dormant")) {
      const minDaysInactive = parseInt(url.searchParams.get("min_days_inactive") || "14");
      const maxDaysInactive = parseInt(url.searchParams.get("max_days_inactive") || "30");
      const limit = parseInt(url.searchParams.get("limit") || "100");

      const vipDormant = mockPlayers.filter(p =>
        (p.vip_level === "gold" || p.vip_level === "platinum" || p.vip_level === "silver") &&
        p.days_inactive >= minDaysInactive &&
        p.days_inactive <= maxDaysInactive &&
        p.account_status === "active"
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

    // GET /api/customers/{player_id}
    const customerMatch = path.match(/\/customers\/([^\/]+)$/);
    if (customerMatch && req.method === "GET") {
      const playerId = customerMatch[1];
      const player = mockPlayers.find(p => p.player_id === playerId);

      if (!player) {
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

      return new Response(
        JSON.stringify({
          success: true,
          customer: player
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
          details: `Path ${path} not recognized. See documentation for available endpoints.`
        }
      } as ApiResponse<never>),
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
      } as ApiResponse<never>),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
