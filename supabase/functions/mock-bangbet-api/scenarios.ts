import type { MockState } from "./types.ts";

// Scenario configurations
export const scenarios = {
    normal: {
        name: "normal",
        description: "Normal operation",
        rateLimit: 100,
        errorRate: 0,
        slowResponseRate: 0,
        responseDelay: 0
    },
    rate_limit: {
        name: "rate_limit",
        description: "Simulate rate limiting (10 requests per minute)",
        rateLimit: 10,
        errorRate: 0,
        slowResponseRate: 0,
        responseDelay: 0
    },
    server_error: {
        name: "server_error",
        description: "Random 500 errors (30% of requests)",
        rateLimit: 100,
        errorRate: 0.3,
        slowResponseRate: 0,
        responseDelay: 0
    },
    slow_response: {
        name: "slow_response",
        description: "Slow responses (3-8 seconds)",
        rateLimit: 100,
        errorRate: 0,
        slowResponseRate: 1.0,
        responseDelay: 3000
    },
    vip_dormant: {
        name: "vip_dormant",
        description: "Focus on VIP dormant players",
        rateLimit: 100,
        errorRate: 0,
        slowResponseRate: 0,
        responseDelay: 0
    }
};

// Global mock state
export let mockState: MockState = {
    scenario: "normal",
    rateLimitCount: 0,
    rateLimitReset: Date.now() + 60000,
    assignedPromotions: [],
    callOutcomes: [],
    deposits: []
};

// Reset state
export function resetMockState() {
    mockState = {
        scenario: "normal",
        rateLimitCount: 0,
        rateLimitReset: Date.now() + 60000,
        assignedPromotions: [],
        callOutcomes: [],
        deposits: []
    };
}

// Set scenario
export function setScenario(scenarioName: string) {
    if (scenarios[scenarioName as keyof typeof scenarios]) {
        mockState.scenario = scenarioName;
        return true;
    }
    return false;
}

// Check rate limit
export function checkRateLimit(): boolean {
    const now = Date.now();

    // Reset counter if window expired
    if (now > mockState.rateLimitReset) {
        mockState.rateLimitCount = 0;
        mockState.rateLimitReset = now + 60000;
    }

    const scenario = scenarios[mockState.scenario as keyof typeof scenarios] || scenarios.normal;
    mockState.rateLimitCount++;

    return mockState.rateLimitCount <= scenario.rateLimit;
}

// Check if should return error
export function shouldReturnError(): boolean {
    const scenario = scenarios[mockState.scenario as keyof typeof scenarios] || scenarios.normal;
    return Math.random() < scenario.errorRate;
}

// Get response delay
export function getResponseDelay(): number {
    const scenario = scenarios[mockState.scenario as keyof typeof scenarios] || scenarios.normal;

    if (Math.random() < scenario.slowResponseRate) {
        // Random delay between 3-8 seconds
        return scenario.responseDelay + Math.random() * 5000;
    }

    return 0;
}

// Simulate delay
export async function simulateDelay() {
    const delay = getResponseDelay();
    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

// Validate API key
export function validateApiKey(authHeader: string | null, apikeyHeader: string | null): boolean {
    if (!authHeader && !apikeyHeader) return false;

    // Accept custom API keys
    const validKeys = ["test_key", "dev_key", "staging_key"];

    if (authHeader) {
        const key = authHeader.replace("Api-Key ", "").replace("Bearer ", "").trim();
        if (validKeys.includes(key)) return true;

        // Also accept any Bearer token (Supabase anon key)
        if (authHeader.startsWith("Bearer ")) return true;
    }

    // Accept Supabase apikey header
    if (apikeyHeader && apikeyHeader.length > 20) return true;

    return false;
}
