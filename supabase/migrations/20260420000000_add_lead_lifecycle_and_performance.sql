-- Add columns for lead lifecycle management and post-call performance tracking
-- Migration: 20260420000000_add_lead_lifecycle_and_performance.sql

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(50) DEFAULT 'new',
ADD COLUMN IF NOT EXISTS follow_up_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS post_call_deposit_ugx NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS post_call_bet_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS post_call_last_activity TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS performance_updated_at TIMESTAMP WITH TIME ZONE;

-- Add comments for clarity
COMMENT ON COLUMN leads.lifecycle_stage IS 'Current stage in the sales funnel (new, interested, follow_up, converted, dead)';
COMMENT ON COLUMN leads.follow_up_category IS 'Manager assigned category for promising leads (e.g., VIP, Regular, High Potential)';
COMMENT ON COLUMN leads.post_call_deposit_ugx IS 'Total amount deposited after the first dialer call';
COMMENT ON COLUMN leads.post_call_bet_count IS 'Number of bets placed after the first dialer call';
COMMENT ON COLUMN leads.performance_updated_at IS 'Timestamp of the last performance data import';
