// TypeScript types for Mock BangBet API

export interface Player {
    player_id: string;
    phone: string;
    name: string;
    vip_level: "bronze" | "silver" | "gold" | "platinum";
    preferred_product: "aviator" | "casino" | "sportsbook";
    language_preference: "english" | "kiswahili" | "luganda" | "runyankole";
    timezone: string;
    last_login: string;
    last_deposit: string;
    total_deposits: number;
    currency: string;
    days_inactive: number;
    lifetime_value: number;
    registration_date: string;
    current_balance: number;
    total_withdrawals: number;
    total_bets: number;
    average_bet_size: number;
    marketing_consent: boolean;
    account_status: "active" | "self_excluded" | "do_not_call" | "suspended";
    call_window_start?: string; // HH:MM format
    call_window_end?: string; // HH:MM format
}

export interface BettingPatterns {
    player_id: string;
    sportsbook: {
        active: boolean;
        total_bets: number;
        total_wagered: number;
        favorite_sport: string;
        average_bet_size: number;
        last_bet_date: string | null;
    };
    casino: {
        active: boolean;
        total_bets: number;
        total_wagered: number;
        favorite_games: string[];
        average_bet_size: number;
        last_bet_date: string | null;
    };
    aviator: {
        active: boolean;
        total_rounds: number;
        total_wagered: number;
        average_multiplier: number;
        highest_win: number;
        last_play_date: string | null;
    };
}

export interface CallEligibility {
    player_id: string;
    call_allowed: boolean;
    reason?: string;
    next_available_time?: string;
    restrictions: {
        self_excluded: boolean;
        do_not_call: boolean;
        outside_call_window: boolean;
        recent_call: boolean;
    };
}

export interface Promotion {
    promotion_id: string;
    name: string;
    description: string;
    type: "deposit_bonus" | "free_bet" | "cashback" | "free_spins";
    value: number;
    currency: string;
    product: "aviator" | "casino" | "sportsbook" | "all";
    eligibility_criteria: {
        min_vip_level?: string;
        min_deposits?: number;
        min_inactive_days?: number;
        max_inactive_days?: number;
    };
    valid_until: string;
}

export interface PromotionAssignment {
    assignment_id: string;
    player_id: string;
    promotion_id: string;
    assigned_at: string;
    assigned_by: string;
    status: "pending" | "accepted" | "rejected" | "expired";
}

export interface CallOutcome {
    outcome_id: string;
    player_id: string;
    agent_id: string;
    call_date: string;
    outcome: "answered" | "no_answer" | "busy" | "rejected" | "voicemail";
    disposition: "interested" | "not_interested" | "callback" | "do_not_call" | "wrong_number";
    notes?: string;
    promotion_offered?: string;
    promotion_accepted?: boolean;
    promised_deposit_amount?: number;
    callback_scheduled?: string;
}

export interface Deposit {
    deposit_id: string;
    player_id: string;
    amount: number;
    currency: string;
    deposit_date: string;
    method: "mobile_money" | "bank_transfer" | "card" | "crypto";
    status: "completed" | "pending" | "failed";
}

export interface ActivitySummary {
    player_id: string;
    last_login: string | null;
    total_deposits_since: number;
    deposit_count_since: number;
    total_bets_since: number;
    total_wagered_since: number;
    products_used: string[];
    active_since_call: boolean;
}

export interface MockState {
    scenario: string;
    rateLimitCount: number;
    rateLimitReset: number;
    assignedPromotions: PromotionAssignment[];
    callOutcomes: CallOutcome[];
    deposits: Deposit[];
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}
