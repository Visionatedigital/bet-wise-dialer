export type ScriptCategory = 'VIP' | 'DORMANT' | 'NEW';

export const SCRIPT_SNIPPETS: Record<ScriptCategory, string[]> = {
  VIP: [
    "Thanks for being one of our top players — we value your loyalty.",
    "There's a special VIP offer today on top matches — boosted odds and cashback.",
    "Top up now and you'll automatically qualify for the VIP bonus.",
    "Would you like me to guide you through a quick top-up or bet placement?",
    "Use mobile money and your bonus will be active instantly."
  ],
  DORMANT: [
    "We’ve missed seeing your name on the winners’ list — welcome back!",
    "Deposit at least the minimum today and get a comeback bonus to restart strong.",
    "Our odds this week on top events are excellent — perfect time to return.",
    "Your account is still active — I can text you the link to deposit now.",
    "The comeback bonus is valid today; shall we activate it together?"
  ],
  NEW: [
    "Welcome to Betsure — happy to help you place your first winning bet.",
    "New users get a welcome bonus after their first deposit — quick and easy.",
    "I can guide you to make a first deposit and show how to place a quick bet.",
    "Go to Deposit in the app, top up with mobile money, and bonus adds automatically.",
    "No pressure — I can send a short guide with current offers to explore anytime."
  ]
};

export function getCategoryFromSegment(segment?: string | null): ScriptCategory {
  if (!segment) return 'NEW';
  const normalized = segment.toLowerCase();
  if (normalized.includes('vip')) return 'VIP';
  if (normalized.includes('dormant') || normalized.includes('reactiv')) return 'DORMANT';
  return 'NEW';
}
