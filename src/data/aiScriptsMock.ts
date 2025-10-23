export type ScriptCategory = 'VIP' | 'DORMANT' | 'NEW';

export interface TimedSuggestion {
  delay: number; // seconds from call start
  type: 'action' | 'compliance' | 'info';
  confidence: 'high' | 'medium' | 'low';
  title: string;
  message: string;
}

// NEW USER - First Deposit Flow
const NEW_USER_SEQUENCE: TimedSuggestion[] = [
  {
    delay: 3,
    type: 'action',
    confidence: 'high',
    title: 'Warm Welcome',
    message: "Start with: 'Welcome to Betsure!' Keep tone warm and energetic."
  },
  {
    delay: 8,
    type: 'info',
    confidence: 'high',
    title: 'Build Curiosity',
    message: "Mention the new-user reward: '100% deposit bonus or free bet on first ticket'"
  },
  {
    delay: 15,
    type: 'action',
    confidence: 'high',
    title: 'Ask About Deposit',
    message: "Check if they've made their first deposit yet. Keep it casual."
  },
  {
    delay: 22,
    type: 'action',
    confidence: 'high',
    title: 'Simplify Process',
    message: "Explain: 'Just go to Deposit, choose Mobile Money, bonus activates automatically'"
  },
  {
    delay: 30,
    type: 'info',
    confidence: 'high',
    title: 'Add Value',
    message: "Mention trending match/event: 'Strong odds on [current game] - perfect to start winning'"
  },
  {
    delay: 38,
    type: 'action',
    confidence: 'high',
    title: 'Close with Urgency',
    message: "Ask: 'Would you like me to guide you through your first deposit right now?'"
  },
  {
    delay: 45,
    type: 'action',
    confidence: 'medium',
    title: 'If Yes - Guide',
    message: "Walk them through: 'Open app → Deposit → Choose MTN/Airtel → Bonus reflects instantly'"
  },
  {
    delay: 52,
    type: 'action',
    confidence: 'medium',
    title: 'If Hesitant',
    message: "Offer SMS: 'I'll send promo details - make sure to deposit today for welcome reward'"
  },
  {
    delay: 60,
    type: 'compliance',
    confidence: 'high',
    title: 'End Positively',
    message: "Close: 'Welcome to Betsure - we're excited to have you win with us!'"
  }
];

// DORMANT USER - Reactivation Flow
const DORMANT_USER_SEQUENCE: TimedSuggestion[] = [
  {
    delay: 3,
    type: 'action',
    confidence: 'high',
    title: 'Friendly Reconnection',
    message: "Start warm: 'Hope you're doing well!' Keep tone friendly, not pushy."
  },
  {
    delay: 10,
    type: 'info',
    confidence: 'high',
    title: 'We Miss You',
    message: "Say: 'We've missed seeing your name on our winners list!' Make them feel valued."
  },
  {
    delay: 17,
    type: 'action',
    confidence: 'high',
    title: 'Introduce Comeback Bonus',
    message: "Present offer: 'Comeback Bonus this week - 50% top-up for returning players'"
  },
  {
    delay: 25,
    type: 'action',
    confidence: 'high',
    title: 'Make It Easy',
    message: "Reassure: 'Account still active - just log in and deposit. Takes seconds.'"
  },
  {
    delay: 33,
    type: 'info',
    confidence: 'high',
    title: 'Build FOMO',
    message: "Create urgency: 'Huge odds this weekend on [popular teams]. Great time to jump back in!'"
  },
  {
    delay: 42,
    type: 'action',
    confidence: 'high',
    title: 'Direct Close',
    message: "Ask: 'Can I send the link or walk you through deposit now to grab the comeback bonus?'"
  },
  {
    delay: 50,
    type: 'action',
    confidence: 'medium',
    title: 'If Hesitant',
    message: "Offer text: 'I'll send bonus link + expiry time. It's exclusive and ends soon!'"
  },
  {
    delay: 58,
    type: 'compliance',
    confidence: 'high',
    title: 'Grateful End',
    message: "Close: 'Happy to have you back anytime. Hope to see you winning again soon!'"
  }
];

// VIP USER - Retention & Loyalty Flow
const VIP_USER_SEQUENCE: TimedSuggestion[] = [
  {
    delay: 3,
    type: 'action',
    confidence: 'high',
    title: 'Personal Appreciation',
    message: "Start VIP: 'You've been one of our top bettors - we truly appreciate your loyalty'"
  },
  {
    delay: 11,
    type: 'info',
    confidence: 'high',
    title: 'Exclusive Tone',
    message: "Emphasize: 'Special VIP offer - only for our top players' Make them feel elite."
  },
  {
    delay: 19,
    type: 'action',
    confidence: 'high',
    title: 'Early Access',
    message: "Mention: 'Early access to exclusive odds, cashback, or boosted games this week'"
  },
  {
    delay: 27,
    type: 'info',
    confidence: 'high',
    title: 'Make It Conversational',
    message: "Casual: 'You've probably seen the big match coming up - we boosted odds for VIPs'"
  },
  {
    delay: 36,
    type: 'action',
    confidence: 'high',
    title: 'VIP Benefit',
    message: "Present: 'Top up today and you'll qualify automatically for [VIP benefit]'"
  },
  {
    delay: 44,
    type: 'action',
    confidence: 'high',
    title: 'Direct Link Offer',
    message: "Ask: 'Would you like me to send the link directly to your phone?'"
  },
  {
    delay: 52,
    type: 'action',
    confidence: 'medium',
    title: 'If Yes',
    message: "Confirm: 'I'll send it right after this call. Bonus activates instantly on deposit'"
  },
  {
    delay: 59,
    type: 'action',
    confidence: 'medium',
    title: 'If Hesitant',
    message: "Create urgency: 'Valid until [date] - recommend doing it today for top odds'"
  },
  {
    delay: 67,
    type: 'compliance',
    confidence: 'high',
    title: 'VIP Gratitude',
    message: "End: 'Thanks for being VIP family. We love having you - good luck on your next win!'"
  }
];

const SCRIPT_SEQUENCES: Record<ScriptCategory, TimedSuggestion[]> = {
  NEW: NEW_USER_SEQUENCE,
  DORMANT: DORMANT_USER_SEQUENCE,
  VIP: VIP_USER_SEQUENCE
};

export function getCategoryFromSegment(segment?: string | null): ScriptCategory {
  if (!segment) return 'NEW';
  const normalized = segment.toLowerCase();
  if (normalized.includes('vip')) return 'VIP';
  if (normalized.includes('dormant') || normalized.includes('reactiv')) return 'DORMANT';
  return 'NEW';
}

export function getSequenceForCategory(category: ScriptCategory): TimedSuggestion[] {
  return SCRIPT_SEQUENCES[category];
}
