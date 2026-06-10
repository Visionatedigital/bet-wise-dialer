// Shared lead-pipeline logic: classification, cooldowns, import decisions.

export type LifecycleStage =
  | 'new'
  | 'called'
  | 'interested'
  | 'promised'
  | 'converted'
  | 'dead';

// Cooldown windows (days) keyed by the last disposition a lead received.
// These are guidance values surfaced in the agent UI; they do not hard-block calls.
export const COOLDOWN_DAYS: Record<string, number> = {
  interested: 1,
  promised: 1,
  no_answer: 2,
  answered_no_response: 2,
  unreachable: 3,
  not_interested: 7,
  dead: 30,
};

// A lead marked 'dead' is eligible for recycling after this many days.
export const DEAD_RECYCLE_DAYS = 30;

export interface Classification {
  segment: string;
  priority: string;
  score: number;
  trait: string | null;
}

/**
 * Classify a lead from its raw betting-platform data.
 * Mirrors the client-side classifier so the server is the source of truth.
 */
export function classifyLead(input: {
  deposit_usd?: number;
  deposit_local?: number;
  total_bets?: number;
  last_login_date?: string | Date | null;
}): Classification {
  const depositUSD = Number(input.deposit_usd || 0);
  const depositLocal = Number(input.deposit_local || 0);
  const totalBets = Number(input.total_bets || 0);

  if (depositUSD >= 1000 || depositLocal >= 3_500_000) {
    return {
      segment: 'vip',
      priority: 'high',
      score: Math.min(95, 70 + Math.floor(depositUSD / 500)),
      trait: 'High Staker',
    };
  }
  if (depositUSD >= 200 || depositLocal >= 700_000) {
    return {
      segment: 'semi-active',
      priority: 'medium',
      score: Math.min(70, 40 + Math.floor(depositUSD / 100)),
      trait: 'Medium Staker',
    };
  }
  if (totalBets >= 500) {
    return { segment: 'semi-active', priority: 'medium', score: 45, trait: 'Frequent Bettor' };
  }

  if (input.last_login_date) {
    const d = input.last_login_date instanceof Date
      ? input.last_login_date
      : new Date(input.last_login_date);
    if (!isNaN(d.getTime())) {
      const daysSince = Math.floor((Date.now() - d.getTime()) / 86_400_000);
      if (daysSince > 60) {
        return { segment: 'dormant', priority: 'low', score: 15, trait: 'Dormant' };
      }
    }
  }
  return {
    segment: depositUSD > 50 ? 'semi-active' : 'dormant',
    priority: depositUSD > 50 ? 'medium' : 'low',
    score: depositUSD > 50 ? 35 : 20,
    trait: depositUSD > 0 ? 'Low Staker' : null,
  };
}

/**
 * Compute when a lead can next be called, based on its last disposition.
 * Returns null if there is no cooldown (never called, or unknown disposition).
 */
export function computeCooldownUntil(
  lastContactAt: Date | string | null,
  lastDisposition: string | null
): Date | null {
  if (!lastContactAt || !lastDisposition) return null;
  const days = COOLDOWN_DAYS[lastDisposition];
  if (!days) return null;
  const base = lastContactAt instanceof Date ? lastContactAt : new Date(lastContactAt);
  if (isNaN(base.getTime())) return null;
  return new Date(base.getTime() + days * 86_400_000);
}

export type ImportDecision =
  | { action: 'insert'; reason: 'new_phone' }
  | { action: 'update_full'; reason: 'never_called' }
  | { action: 'update_enrich_only'; reason: 'active_pipeline' }
  | { action: 'update_with_delta'; reason: 'already_converted' }
  | { action: 'recycle'; reason: 'dead_past_cooldown' }
  | { action: 'skip'; reason: 'dead_too_soon' };

/**
 * Decide what to do with an incoming lead record based on any existing lead state.
 * This is the heart of the duplicate-handling strategy: we never blindly skip.
 */
export function decideImport(existing: {
  lifecycle_stage?: string | null;
  call_count?: number | null;
  last_contact_at?: Date | string | null;
} | null): ImportDecision {
  if (!existing) return { action: 'insert', reason: 'new_phone' };

  const stage = (existing.lifecycle_stage || 'new') as LifecycleStage;
  const calls = Number(existing.call_count || 0);

  if (stage === 'new' && calls === 0) return { action: 'update_full', reason: 'never_called' };

  if (stage === 'called' || stage === 'interested' || stage === 'promised') {
    return { action: 'update_enrich_only', reason: 'active_pipeline' };
  }

  if (stage === 'converted') return { action: 'update_with_delta', reason: 'already_converted' };

  if (stage === 'dead') {
    const last = existing.last_contact_at
      ? (existing.last_contact_at instanceof Date
          ? existing.last_contact_at
          : new Date(existing.last_contact_at))
      : null;
    if (!last || isNaN(last.getTime())) {
      return { action: 'recycle', reason: 'dead_past_cooldown' };
    }
    const daysSince = Math.floor((Date.now() - last.getTime()) / 86_400_000);
    return daysSince >= DEAD_RECYCLE_DAYS
      ? { action: 'recycle', reason: 'dead_past_cooldown' }
      : { action: 'skip', reason: 'dead_too_soon' };
  }

  return { action: 'update_full', reason: 'never_called' };
}

export interface EnrichmentOutcome {
  deposit_delta_usd: number;
  bets_delta: number;
  last_login_after_call: boolean;
  attributable_deposit_usd: number;
  conversion_triggered: boolean;
  classification_changed: 'upgraded' | 'downgraded' | 'unchanged';
}

/**
 * Cross-reference fresh enrichment data with the lead's existing state and call history.
 * Decides: what's attributable to agent calls vs pre-existing activity, and whether
 * to promote the lead to 'converted' or re-classify it up/down.
 */
export function evaluateEnrichment(params: {
  previous: {
    deposit_usd?: number;
    total_bets?: number;
    lifecycle_stage?: string | null;
    last_contact_at?: Date | string | null;
    score?: number;
  };
  fresh: {
    deposit_usd?: number;
    total_bets?: number;
    last_login_date?: Date | string | null;
  };
  newClassification: Classification;
}): EnrichmentOutcome {
  const prevDep = Number(params.previous.deposit_usd || 0);
  const newDep = Number(params.fresh.deposit_usd || 0);
  const prevBets = Number(params.previous.total_bets || 0);
  const newBets = Number(params.fresh.total_bets || 0);
  const deposit_delta_usd = Math.max(0, newDep - prevDep);
  const bets_delta = Math.max(0, newBets - prevBets);

  const lastContact = params.previous.last_contact_at
    ? (params.previous.last_contact_at instanceof Date
        ? params.previous.last_contact_at
        : new Date(params.previous.last_contact_at))
    : null;
  const lastLogin = params.fresh.last_login_date
    ? (params.fresh.last_login_date instanceof Date
        ? params.fresh.last_login_date
        : new Date(params.fresh.last_login_date))
    : null;

  const last_login_after_call = !!(
    lastContact &&
    lastLogin &&
    !isNaN(lastContact.getTime()) &&
    !isNaN(lastLogin.getTime()) &&
    lastLogin.getTime() > lastContact.getTime()
  );

  // Attributable only if they deposited AND their last login was after our call.
  const attributable_deposit_usd = last_login_after_call ? deposit_delta_usd : 0;
  const stage = params.previous.lifecycle_stage;
  const conversion_triggered =
    attributable_deposit_usd > 0 && (stage === 'interested' || stage === 'promised' || stage === 'called');

  const prevScore = Number(params.previous.score || 0);
  const newScore = params.newClassification.score;
  const classification_changed =
    newScore > prevScore + 5 ? 'upgraded'
    : newScore < prevScore - 5 ? 'downgraded'
    : 'unchanged';

  return {
    deposit_delta_usd,
    bets_delta,
    last_login_after_call,
    attributable_deposit_usd,
    conversion_triggered,
    classification_changed,
  };
}

/**
 * Normalize a phone string for matching: digits only.
 * Comparison is done on this form; DB stores whatever came in but we match by digits.
 */
export function digitsOnly(phone: string): string {
  return String(phone || '').replace(/\D/g, '');
}

export function detectCountry(phone: string, defaultCountry = 'UG'): string {
  const d = digitsOnly(phone);
  if (d.startsWith('256')) return 'UG';
  if (d.startsWith('233')) return 'GH';
  if (d.startsWith('234')) return 'NG';
  if (d.startsWith('255')) return 'TZ';
  if (d.startsWith('254')) return 'KE';
  return defaultCountry;
}
