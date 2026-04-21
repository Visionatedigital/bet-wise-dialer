// Mirrors server/src/lib/leadLogic.ts COOLDOWN_DAYS.
// Keep these tables in sync — they are the source of truth for agent UI warnings.

export const COOLDOWN_DAYS: Record<string, number> = {
  interested: 1,
  promised: 1,
  no_answer: 2,
  answered_no_response: 2,
  unreachable: 3,
  not_interested: 7,
  dead: 30,
};

export type CooldownState = {
  severity: "none" | "mild" | "strong" | "clear";
  daysRemaining: number;
  message: string;
  color: string;
  bg: string;
  disposition: string | null;
};

/**
 * Compute the call-cooldown state for a lead given its last disposition and contact time.
 * Returns guidance only — never a hard block.
 */
export function computeCooldown(
  lastContactAt: string | Date | null | undefined,
  lastDisposition: string | null | undefined
): CooldownState {
  if (!lastContactAt || !lastDisposition) {
    return { severity: "none", daysRemaining: 0, message: "", color: "#6b7280", bg: "#f3f4f6", disposition: null };
  }
  const days = COOLDOWN_DAYS[lastDisposition];
  if (!days) {
    return { severity: "none", daysRemaining: 0, message: "", color: "#6b7280", bg: "#f3f4f6", disposition: lastDisposition };
  }

  const last = lastContactAt instanceof Date ? lastContactAt : new Date(lastContactAt);
  if (isNaN(last.getTime())) {
    return { severity: "none", daysRemaining: 0, message: "", color: "#6b7280", bg: "#f3f4f6", disposition: lastDisposition };
  }

  const hoursSince = (Date.now() - last.getTime()) / 3_600_000;
  const daysSince = hoursSince / 24;
  const daysRemaining = Math.max(0, days - daysSince);

  const dispositionLabel = lastDisposition.replace(/_/g, " ");

  if (daysRemaining <= 0) {
    return {
      severity: "clear",
      daysRemaining: 0,
      message: `Ready to call — last: ${dispositionLabel}`,
      color: "#059669",
      bg: "#ecfdf5",
      disposition: lastDisposition,
    };
  }

  // Strong cooldown for explicit not_interested or long waits, mild otherwise.
  const isStrong = lastDisposition === "not_interested" || daysRemaining >= 3;
  const rounded = Math.ceil(daysRemaining);
  const remainingText = daysRemaining < 1
    ? `${Math.max(1, Math.ceil(daysRemaining * 24))}h`
    : `${rounded}d`;

  return {
    severity: isStrong ? "strong" : "mild",
    daysRemaining,
    message: isStrong
      ? `Wait ${remainingText} before calling — last: ${dispositionLabel}`
      : `Called recently (${dispositionLabel}) — wait ${remainingText} recommended`,
    color: isStrong ? "#b91c1c" : "#b45309",
    bg: isStrong ? "#fef2f2" : "#fffbeb",
    disposition: lastDisposition,
  };
}
