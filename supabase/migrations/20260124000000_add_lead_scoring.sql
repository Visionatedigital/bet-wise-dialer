-- Add columns for lead scoring and AI analysis
-- Migration: 20260124000000_add_lead_scoring.sql

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS lifetime_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS preferred_product TEXT,
ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS betting_patterns JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS analysis_notes TEXT;

-- Add comments for clarity
COMMENT ON COLUMN leads.lifetime_value IS 'Total lifetime value of the player (Total Deposits)';
COMMENT ON COLUMN leads.lead_score IS 'AI-calculated score (0-100) representing lead quality based on LTV and activity';
COMMENT ON COLUMN leads.betting_patterns IS 'Snapshot of betting behavior at time of import';
