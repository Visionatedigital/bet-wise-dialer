-- Add columns for tracking promised deposits, actual deposits, and BangBet sync status
-- Migration: 20260122000003_add_deposit_tracking_to_calls.sql

-- Add new columns to telemarketing_calls table
ALTER TABLE telemarketing_calls 
ADD COLUMN IF NOT EXISTS promised_deposit_amount INTEGER,
ADD COLUMN IF NOT EXISTS actual_deposit_amount INTEGER,
ADD COLUMN IF NOT EXISTS deposit_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bangbet_sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS bangbet_sync_at TIMESTAMPTZ;

-- Create indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_telemarketing_calls_disposition 
ON telemarketing_calls(disposition, call_date);

CREATE INDEX IF NOT EXISTS idx_telemarketing_calls_sync_status 
ON telemarketing_calls(bangbet_sync_status);

CREATE INDEX IF NOT EXISTS idx_telemarketing_calls_verification 
ON telemarketing_calls(deposit_verified_at) 
WHERE disposition = 'interested';

-- Add comment to explain the columns
COMMENT ON COLUMN telemarketing_calls.promised_deposit_amount IS 'Amount the customer promised to deposit during the call (in UGX)';
COMMENT ON COLUMN telemarketing_calls.actual_deposit_amount IS 'Actual amount deposited by customer after the call (verified from BangBet)';
COMMENT ON COLUMN telemarketing_calls.deposit_verified_at IS 'Timestamp when the deposit was verified from BangBet';
COMMENT ON COLUMN telemarketing_calls.bangbet_sync_status IS 'Status of sync to BangBet: pending, synced, failed';
COMMENT ON COLUMN telemarketing_calls.bangbet_sync_at IS 'Timestamp when the call outcome was synced to BangBet';
