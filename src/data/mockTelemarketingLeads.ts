// Mock data for Kanban demonstration
export const MOCK_TELEMARKETING_LEADS = [
    // No Answer
    {
        id: "4",
        player_id: "PLAYER004",
        phone: "+256700456789",
        player_name: "Grace Auma",
        vip_level: "gold",
        preferred_product: "casino",
        status: "called_no_answer",
        priority: "medium",
        follow_up_at: new Date(Date.now() + 86400000).toISOString(),
        notes: "Called 2 times, no answer",
        betting_habits: {
            favorite_sport: null,
            favorite_teams: null,
            casino_favorite: "roulette"
        }
    },
    {
        id: "5",
        player_id: "PLAYER005",
        phone: "+256700567890",
        player_name: "Peter Musoke",
        vip_level: "bronze",
        preferred_product: "sportsbook",
        status: "called_no_answer",
        priority: "low",
        follow_up_at: new Date(Date.now() + 172800000).toISOString(),
        notes: null,
        betting_habits: {
            favorite_sport: "football",
            favorite_teams: ["Liverpool"],
            casino_favorite: null
        }
    },
    // Call Back Later
    {
        id: "6",
        player_id: "PLAYER006",
        phone: "+256700678901",
        player_name: "Mary Nabirye",
        vip_level: "platinum",
        preferred_product: "sportsbook",
        status: "interested",
        priority: "high",
        follow_up_at: new Date(Date.now() + 43200000).toISOString(),
        notes: "Requested callback at 3 PM",
        betting_habits: {
            favorite_sport: "football",
            favorite_teams: ["Chelsea", "Real Madrid"],
            casino_favorite: null
        }
    },
    {
        id: "7",
        player_id: "PLAYER007",
        phone: "+256700789012",
        player_name: "James Opio",
        vip_level: "gold",
        preferred_product: "aviator",
        status: "interested",
        priority: "high",
        follow_up_at: new Date(Date.now() + 21600000).toISOString(),
        notes: "Busy now, call back in evening",
        betting_habits: {
            favorite_sport: null,
            favorite_teams: null,
            casino_favorite: "aviator"
        }
    },
    // Not Interested
    {
        id: "13",
        player_id: "PLAYER013",
        phone: "+256701345678",
        player_name: "Isaac Okoth",
        vip_level: "silver",
        preferred_product: "sportsbook",
        status: "not_interested",
        priority: "low",
        follow_up_at: null,
        notes: "Not interested in current promotions",
        betting_habits: {
            favorite_sport: "football",
            favorite_teams: ["Tottenham"],
            casino_favorite: null
        }
    },
    // Interested
    {
        id: "8",
        player_id: "PLAYER008",
        phone: "+256700890123",
        player_name: "Rebecca Atim",
        vip_level: "platinum",
        preferred_product: "sportsbook",
        status: "interested",
        priority: "high",
        follow_up_at: null,
        notes: "Very interested in Premier League promo",
        betting_habits: {
            favorite_sport: "football",
            favorite_teams: ["Manchester City"],
            casino_favorite: null
        }
    },
    {
        id: "9",
        player_id: "PLAYER009",
        phone: "+256700901234",
        player_name: "Moses Kato",
        vip_level: "silver",
        preferred_product: "casino",
        status: "interested",
        priority: "medium",
        follow_up_at: null,
        notes: "Likes the casino bonus offer",
        betting_habits: {
            favorite_sport: null,
            favorite_teams: null,
            casino_favorite: "slots"
        }
    },
    // Converted
    {
        id: "10",
        player_id: "PLAYER010",
        phone: "+256701012345",
        player_name: "Alice Nambi",
        vip_level: "gold",
        preferred_product: "aviator",
        status: "deposited",
        priority: "low",
        follow_up_at: null,
        notes: "Deposited 100,000 UGX",
        betting_habits: {
            favorite_sport: null,
            favorite_teams: null,
            casino_favorite: "aviator"
        }
    },
    {
        id: "11",
        player_id: "PLAYER011",
        phone: "+256701123456",
        player_name: "Patrick Ssemakula",
        vip_level: "platinum",
        preferred_product: "sportsbook",
        status: "interested",
        priority: "low",
        follow_up_at: null,
        notes: "Deposited 500,000 UGX - VIP bonus applied",
        betting_habits: {
            favorite_sport: "football",
            favorite_teams: ["Barcelona", "Bayern Munich"],
            casino_favorite: null
        }
    },
    // Unreachable
    {
        id: "12",
        player_id: "PLAYER012",
        phone: "+256701234567",
        player_name: "Susan Akello",
        vip_level: "bronze",
        preferred_product: "sportsbook",
        status: "unreachable",
        priority: "low",
        follow_up_at: null,
        notes: "Number disconnected",
        betting_habits: {
            favorite_sport: "tennis",
            favorite_teams: null,
            casino_favorite: null
        }
    }
];
