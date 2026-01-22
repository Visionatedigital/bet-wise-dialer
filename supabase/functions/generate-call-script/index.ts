import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Dynamic Call Script Generator
 * 
 * Generates personalized call scripts based on customer betting habits
 * from BangBet API data. This is the KEY feature that improves conversion
 * by making each call relevant to the customer's interests.
 */

interface CustomerData {
    player_id: string;
    name: string;
    vip_level: string;
    days_inactive: number;
    current_balance: number;
    betting_behavior: {
        favorite_sport?: string;
        sports_breakdown?: Record<string, number>;
        favorite_leagues?: string[];
        favorite_teams?: string[];
        preferred_bet_type?: string;
        average_bet_size?: number;
        biggest_win?: number;
        casino_games_played?: string[];
        casino_favorite?: string;
        aviator_stats?: {
            rounds_played: number;
            average_cashout_multiplier: number;
            biggest_win_multiplier: number;
        };
        betting_time_preference?: string;
        peak_betting_days?: string[];
    };
    preferred_language?: string;
}

interface CallScript {
    opening: string;
    rapport_building: string;
    value_proposition: string;
    offer: string;
    objection_handling: string[];
    closing: string;
    talking_points: string[];
    personalization_notes: string[];
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { customerData, campaignType }: { customerData: CustomerData; campaignType: string } = await req.json();

        if (!customerData) {
            throw new Error("Customer data is required");
        }

        console.log(`[Script Generator] Generating script for ${customerData.player_id}, campaign: ${campaignType}`);

        const script = generatePersonalizedScript(customerData, campaignType);

        return new Response(
            JSON.stringify({
                success: true,
                script: script
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[Script Generator] Error:", error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});

function generatePersonalizedScript(customer: CustomerData, campaignType: string): CallScript {
    const behavior = customer.betting_behavior;
    const vipTitle = getVIPTitle(customer.vip_level);

    // Determine primary interest
    const primaryInterest = determinePrimaryInterest(behavior);

    // Build personalized script
    const script: CallScript = {
        opening: generateOpening(customer, vipTitle),
        rapport_building: generateRapport(customer, behavior, primaryInterest),
        value_proposition: generateValueProp(customer, behavior, primaryInterest, campaignType),
        offer: generateOffer(customer, behavior, primaryInterest, campaignType),
        objection_handling: generateObjectionHandlers(customer, primaryInterest),
        closing: generateClosing(customer, primaryInterest),
        talking_points: generateTalkingPoints(customer, behavior, primaryInterest),
        personalization_notes: generatePersonalizationNotes(customer, behavior)
    };

    return script;
}

function getVIPTitle(vipLevel: string): string {
    const titles: Record<string, string> = {
        platinum: "Platinum VIP",
        gold: "Gold VIP",
        silver: "Silver VIP",
        bronze: "valued"
    };
    return titles[vipLevel] || "valued";
}

function determinePrimaryInterest(behavior: any): string {
    // Determine what the customer is most interested in
    if (behavior.casino_favorite === "aviator" && behavior.aviator_stats?.rounds_played > 50) {
        return "aviator";
    }

    if (behavior.casino_games_played?.length > 0 && behavior.sports_breakdown?.football < 50) {
        return "casino";
    }

    if (behavior.favorite_sport) {
        return "sportsbook";
    }

    return "general";
}

function generateOpening(customer: CustomerData, vipTitle: string): string {
    const greeting = customer.preferred_language === "luganda"
        ? "Osiibire otya nnyabo/ssebo"
        : customer.preferred_language === "kiswahili"
            ? "Habari yako"
            : "Good afternoon";

    return `${greeting} ${customer.name}! This is [YOUR NAME] calling from BangBet. How are you doing today?

[WAIT FOR RESPONSE]

I'm reaching out to our ${vipTitle} members who we haven't seen in a while. We really value your loyalty and wanted to check in with you personally.`;
}

function generateRapport(customer: CustomerData, behavior: any, interest: string): string {
    let rapport = "";

    if (interest === "sportsbook" && behavior.favorite_teams?.length > 0) {
        rapport = `I noticed you're a big ${behavior.favorite_teams[0]} fan! `;

        if (behavior.favorite_teams[0].includes("Manchester United")) {
            rapport += "They've been having quite a season. Did you catch their last match?";
        } else if (behavior.favorite_teams[0].includes("Arsenal")) {
            rapport += "The Gunners are looking strong this season! Have you been following their matches?";
        } else {
            rapport += "Have you been keeping up with their recent games?";
        }
    } else if (interest === "aviator") {
        rapport = `I see you're one of our Aviator champions! Your best multiplier of ${behavior.aviator_stats?.biggest_win_multiplier}x is impressive. That must have been an exciting moment!`;
    } else if (interest === "casino") {
        rapport = `I noticed you enjoy our casino games, especially ${behavior.casino_favorite}. Those games can be really exciting!`;
    } else {
        rapport = `I see you've been with us since ${new Date(customer.registration_date || Date.now()).toLocaleDateString()}. We really appreciate your loyalty!`;
    }

    return rapport;
}

function generateValueProp(customer: CustomerData, behavior: any, interest: string, campaign: string): string {
    if (campaign === "VIP_DORMANT") {
        if (interest === "sportsbook") {
            return `Since you've been away, we've added some exciting new features for football betting:
- Live betting with better odds on ${behavior.favorite_leagues?.[0] || "Premier League"}
- Enhanced accumulators with up to 50% bonus on wins
- Special promotions for ${behavior.favorite_teams?.[0] || "your favorite teams"} matches

Plus, as a ${customer.vip_level} VIP member, you get exclusive early access to these features.`;
        } else if (interest === "aviator") {
            return `We've noticed you love Aviator! We've made some exciting updates:
- New auto-cashout features to help you lock in wins
- Special Aviator tournaments with massive prize pools
- VIP-only Aviator sessions with higher multipliers
- Your ${customer.vip_level} status gives you 2x points on every Aviator round`;
        } else if (interest === "casino") {
            return `Our casino section has expanded significantly:
- New slot games with progressive jackpots
- Live dealer games with real-time action
- Special ${customer.vip_level} VIP bonuses on casino games
- Exclusive casino tournaments every weekend`;
        }
    }

    return `We've made significant improvements to the platform and have some exclusive offers for our ${customer.vip_level} VIP members like yourself.`;
}

function generateOffer(customer: CustomerData, behavior: any, interest: string, campaign: string): string {
    const depositBonus = customer.vip_level === "platinum" ? "200%" :
        customer.vip_level === "gold" ? "150%" : "100%";

    if (interest === "sportsbook") {
        return `Here's what I can offer you today as a welcome back gift:

🎁 **${depositBonus} Deposit Bonus** up to 500,000 UGX
⚽ **Free Bet** on your next ${behavior.favorite_sport || "football"} accumulator
🏆 **Boosted Odds** on ${behavior.favorite_leagues?.[0] || "Premier League"} matches this weekend
💎 **VIP Cashback** - 10% on all bets this week

This offer is exclusive to ${customer.vip_level} VIP members and expires in 48 hours.`;
    } else if (interest === "aviator") {
        return `Here's a special Aviator package just for you:

🎁 **${depositBonus} Deposit Bonus** up to 500,000 UGX
✈️ **50 Free Aviator Rounds** with guaranteed minimum 1.5x multiplier
🏆 **VIP Aviator Tournament Entry** - 10 Million UGX prize pool
💎 **Double Points** on all Aviator games for 7 days

This is only available for the next 48 hours!`;
    } else if (interest === "casino") {
        return `Here's an exclusive casino package for you:

🎁 **${depositBonus} Deposit Bonus** up to 500,000 UGX
🎰 **100 Free Spins** on premium slots
🃏 **Live Casino Cashback** - 15% on all losses
💎 **VIP Casino Tournament** access with 5 Million UGX prize pool

Valid for 48 hours only!`;
    }

    return `I can offer you a special ${depositBonus} welcome back bonus up to 500,000 UGX, plus exclusive VIP perks. This is only available for the next 48 hours.`;
}

function generateObjectionHandlers(customer: CustomerData, interest: string): string[] {
    return [
        `**"I'm busy right now"**
→ I completely understand! When would be a better time for me to call you back? I want to make sure you don't miss out on this ${customer.vip_level} VIP offer that expires in 48 hours.`,

        `**"I don't have money to deposit"**
→ I hear you. That's actually why this offer is perfect - you can start with as little as 10,000 UGX and get the ${customer.vip_level === "gold" ? "150%" : "100%"} bonus. Plus, with the free bets, you can play without risking much.`,

        `**"I lost money last time"**
→ I understand that feeling. That's exactly why we've introduced the VIP cashback program - you get 10% back on losses. Plus, with the free ${interest === "aviator" ? "Aviator rounds" : "bets"}, you have a fresh start with no risk.`,

        `**"I'm not interested"**
→ I respect that. Can I ask - is it because you're not betting anymore, or is there something specific about BangBet that didn't work for you? Your feedback helps us improve.`,

        `**"I'll think about it"**
→ Absolutely! Just so you know, this ${customer.vip_level} VIP offer expires in 48 hours. Can I send you the details via SMS so you have everything when you're ready? What's the best number?`
    ];
}

function generateClosing(customer: CustomerData, interest: string): string {
    return `So ${customer.name}, I'd love to get you back in the game with this exclusive offer. 

Can I help you activate this ${customer.vip_level} VIP bonus right now? It only takes 2 minutes, and you'll have the bonus in your account immediately.

[IF YES]: Perfect! Let me guide you through the quick deposit process...

[IF NO]: No problem! I'll send you all the details via SMS. Just remember, this offer expires in 48 hours. Is this the best number to reach you on: ${customer.phone}?

Thank you for your time, ${customer.name}. We really appreciate your loyalty to BangBet!`;
}

function generateTalkingPoints(customer: CustomerData, behavior: any, interest: string): string[] {
    const points: string[] = [
        `Customer is ${customer.vip_level} VIP - emphasize exclusive benefits`,
        `Last active ${customer.days_inactive} days ago - create urgency to return`,
        `Current balance: ${customer.current_balance.toLocaleString()} UGX - mention they can use it`
    ];

    if (interest === "sportsbook") {
        points.push(`Favorite sport: ${behavior.favorite_sport} - focus on football betting`);
        if (behavior.favorite_teams?.length > 0) {
            points.push(`Fan of ${behavior.favorite_teams.join(", ")} - mention upcoming matches`);
        }
        if (behavior.preferred_bet_type) {
            points.push(`Prefers ${behavior.preferred_bet_type} bets - highlight relevant promotions`);
        }
    } else if (interest === "aviator") {
        points.push(`Aviator enthusiast - ${behavior.aviator_stats?.rounds_played} rounds played`);
        points.push(`Best multiplier: ${behavior.aviator_stats?.biggest_win_multiplier}x - congratulate them`);
        points.push(`Focus on Aviator tournaments and VIP sessions`);
    } else if (interest === "casino") {
        points.push(`Casino player - favorite: ${behavior.casino_favorite}`);
        points.push(`Highlight new casino games and live dealer options`);
    }

    if (behavior.betting_time_preference) {
        points.push(`Prefers betting in ${behavior.betting_time_preference} - best time to call back`);
    }

    if (behavior.peak_betting_days?.length > 0) {
        points.push(`Most active on ${behavior.peak_betting_days.join(", ")} - schedule follow-up accordingly`);
    }

    return points;
}

function generatePersonalizationNotes(customer: CustomerData, behavior: any): string[] {
    const notes: string[] = [];

    if (behavior.biggest_win) {
        notes.push(`🏆 Biggest win: ${behavior.biggest_win.toLocaleString()} UGX - mention this to build excitement`);
    }

    if (behavior.average_bet_size) {
        notes.push(`💰 Average bet: ${behavior.average_bet_size.toLocaleString()} UGX - tailor bonus amounts accordingly`);
    }

    if (customer.preferred_language && customer.preferred_language !== "english") {
        notes.push(`🗣️ Preferred language: ${customer.preferred_language} - use appropriate greetings`);
    }

    if (behavior.sports_breakdown) {
        const topSport = Object.entries(behavior.sports_breakdown)
            .sort(([, a], [, b]) => b - a)[0];
        notes.push(`⚽ ${topSport[0]} accounts for ${topSport[1]}% of bets - primary focus area`);
    }

    return notes;
}
