import type { Player, BettingPatterns, Promotion } from "./types.ts";

// Import real players from Excel conversion
import { mockPlayers as realPlayers } from "./real-players-data.ts";

// Use real players from Excel file (1022 players)
export const mockPlayers: Player[] = realPlayers;

// Betting patterns - will be empty for now since we don't have that data
export const mockBettingPatterns: Record<string, BettingPatterns> = {};

// Available promotions
export const mockPromotions: Promotion[] = [
    {
        promotion_id: "PROMO001",
        name: "VIP Welcome Back Bonus",
        description: "50% deposit bonus up to 200,000 UGX for returning VIP players",
        type: "deposit_bonus",
        value: 200000,
        currency: "UGX",
        product: "all",
        eligibility_criteria: {
            min_vip_level: "gold",
            min_inactive_days: 14,
            max_inactive_days: 30
        },
        valid_until: "2026-02-28T23:59:59Z"
    },
    {
        promotion_id: "PROMO002",
        name: "Aviator Free Rounds",
        description: "10 free Aviator rounds worth 5,000 UGX each",
        type: "free_bet",
        value: 50000,
        currency: "UGX",
        product: "aviator",
        eligibility_criteria: {
            min_vip_level: "silver",
            min_inactive_days: 7
        },
        valid_until: "2026-02-15T23:59:59Z"
    },
    {
        promotion_id: "PROMO003",
        name: "Casino Cashback",
        description: "20% cashback on casino losses up to 100,000 UGX",
        type: "cashback",
        value: 100000,
        currency: "UGX",
        product: "casino",
        eligibility_criteria: {
            min_vip_level: "bronze"
        },
        valid_until: "2026-03-31T23:59:59Z"
    }
];
