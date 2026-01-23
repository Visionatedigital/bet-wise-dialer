# Mock BangBet API

A comprehensive mock API server that simulates BangBet's backend APIs for testing and development.

## Features

- **18 Diverse Player Profiles** - Covering all business cases (VIP dormant, active, edge cases, multi-language)
- **7 MVP Endpoints** - Player profiles, betting patterns, eligibility, segmentation, promotions, outcomes
- **Scenario Controls** - Admin endpoints to simulate different behaviors
- **Failure Simulation** - Rate limits, errors, timeouts, auth failures
- **Authentication** - API key validation
- **In-Memory State** - Tracks promotions and call outcomes

## Endpoints

### Player Endpoints

#### GET `/api/players/{id}/profile`
Get full player profile including VIP status, activity, preferences, and financial data.

**Example:**
```bash
curl -H "Authorization: Api-Key test_key" \
  https://your-project.supabase.co/functions/v1/mock-bangbet-api/api/players/UG001234/profile
```

#### GET `/api/players/{id}/betting-patterns`
Get detailed betting behavior across sportsbook, casino, and aviator.

#### GET `/api/players/{id}/call-eligibility`
Check if a player can be called (checks self-exclusion, do-not-call status).

#### GET `/api/players?segment={name}`
Get list of players matching a segment.

**Available segments:**
- `vip_dormant` - VIP players inactive 14-30 days
- `aviator_only` - Players who only play Aviator
- `casino_only` - Players who only play Casino
- `sportsbook_only` - Players who only play Sportsbook
- `inactive_14_days` - Players inactive 14+ days
- `low_balance` - Players with balance < 10,000 UGX
- `high_value` - Players with lifetime value > 2,000,000 UGX

### Promotions Endpoints

#### GET `/api/promotions/eligible?player_id={id}`
Get promotions eligible for a specific player.

#### POST `/api/promotions/assign`
Assign a promotion to a player.

**Body:**
```json
{
  "player_id": "UG001234",
  "promotion_id": "PROMO001",
  "assigned_by": "agent_123"
}
```

### Telemarketing Endpoints

#### POST `/api/telemarketing/call-outcome`
Record the outcome of a call.

**Body:**
```json
{
  "player_id": "UG001234",
  "agent_id": "agent_123",
  "outcome": "answered",
  "disposition": "interested",
  "notes": "Customer interested in Aviator promotion",
  "promotion_offered": "PROMO002",
  "promotion_accepted": true
}
```

### Admin Endpoints

#### POST `/__admin/scenario`
Set the active scenario for testing.

**Body:**
```json
{
  "scenario": "rate_limit"
}
```

**Available scenarios:**
- `normal` - Normal operation
- `rate_limit` - Simulate rate limiting (10 requests/minute)
- `server_error` - Random 500 errors (30% of requests)
- `slow_response` - Slow responses (3-8 seconds)
- `vip_dormant` - Focus on VIP dormant players

#### POST `/__admin/reset`
Reset mock state to defaults (clears promotions and call outcomes).

#### GET `/__admin/status`
Get current mock state and statistics.

## Authentication

All endpoints (except admin) require an API key in the `Authorization` header:

```bash
Authorization: Api-Key test_key
```

**Valid test keys:** `test_key`, `dev_key`, `staging_key`

## Scenario Testing

### Using Header
```bash
curl -H "Authorization: Api-Key test_key" \
     -H "X-Mock-Scenario: slow_response" \
     https://your-project.supabase.co/functions/v1/mock-bangbet-api/api/players/UG001234/profile
```

### Using Admin Endpoint
```bash
# Set scenario
curl -X POST -H "Content-Type: application/json" \
     -d '{"scenario":"rate_limit"}' \
     https://your-project.supabase.co/functions/v1/mock-bangbet-api/__admin/scenario

# Make requests (will be rate limited after 10 requests)
curl -H "Authorization: Api-Key test_key" \
     https://your-project.supabase.co/functions/v1/mock-bangbet-api/api/players/UG001234/profile
```

## Sample Players

The mock includes 18 diverse players:

- **UG001234** - VIP Dormant (Casino, Gold, 17 days inactive)
- **UG001235** - VIP Dormant (Aviator, Gold, 23 days inactive)
- **UG001236** - VIP Dormant (Sportsbook, Platinum, 14 days inactive)
- **UG001237** - Aviator-only active (Silver, 1 day inactive)
- **UG001238** - Casino-only active (Bronze, 0 days inactive)
- **UG001239** - Sportsbook EPL-focused (Gold, 0 days inactive)
- **UG001240** - Low wallet balance (Silver, 2,000 UGX)
- **UG001241** - High churn risk (Gold, 10 days inactive)
- **UG001242** - New depositor, no bets (Bronze, just joined)
- **UG001243** - Recent big win (Platinum, 850,000 UGX balance)
- **UG001244** - Recent big loss (Gold, 5,000 UGX balance)
- **UG001245** - Self-excluded (call blocked)
- **UG001246** - Do-not-call (call blocked)
- **UG001247** - Kiswahili preference
- **UG001248** - Luganda preference
- **UG001249** - Runyankole preference
- **UG001250** - Mixed product user (Platinum, all products)
- **UG001251** - Inactive 30+ days (Silver, 38 days)

## Deployment

Deploy to Supabase:

```bash
supabase functions deploy mock-bangbet-api
```

## Testing

Run contract tests to verify response schemas:

```bash
# Test player profile
curl -H "Authorization: Api-Key test_key" \
  https://your-project.supabase.co/functions/v1/mock-bangbet-api/api/players/UG001234/profile | jq

# Test segmentation
curl -H "Authorization: Api-Key test_key" \
  "https://your-project.supabase.co/functions/v1/mock-bangbet-api/api/players?segment=vip_dormant" | jq

# Test rate limiting
for i in {1..15}; do
  echo "Request $i:"
  curl -H "Authorization: Api-Key test_key" \
    https://your-project.supabase.co/functions/v1/mock-bangbet-api/api/players/UG001234/profile
  echo ""
done
```

## Files

- `index.ts` - Main API handler with all endpoints
- `types.ts` - TypeScript type definitions
- `seed-data.ts` - Player profiles, betting patterns, and promotions
- `scenarios.ts` - Scenario configuration and failure simulation logic
- `README.md` - This file

## License

Proprietary - © 2026 BangBet. All rights reserved.
