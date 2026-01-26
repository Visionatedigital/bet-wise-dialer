-- Add columns for detailed post-call activity tracking
-- Migration: 20260123000005_add_betting_patterns.sql

ALTER TABLE telemarketing_calls 
ADD COLUMN IF NOT EXISTS post_call_wagered_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS post_call_bets_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS post_call_products TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS player_activity_last_checked_at TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN telemarketing_calls.post_call_wagered_amount IS 'Total amount wagered by player since the call';
COMMENT ON COLUMN telemarketing_calls.post_call_bets_count IS 'Total number of bets placed since the call';
COMMENT ON COLUMN telemarketing_calls.post_call_products IS 'List of products (casino, sports, etc) used since the call';
