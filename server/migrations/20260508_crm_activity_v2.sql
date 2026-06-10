-- CRM Activity Workflow V2 Migration
-- This script updates the schema to support detailed activity logging and pending sessions.

-- 1. Update Leads table with new CRM-specific fields
DO $$ BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS vip_level TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS risk_status TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS favourite_product TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS favourite_game TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_deposit_at TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS total_deposits NUMERIC DEFAULT 0;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_bonus TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_contact_time TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_pending_action BOOLEAN DEFAULT FALSE;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS pending_action_type TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_due_at TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. Unified Lead Activities (Timeline)
-- We will use this as the primary source for the UI timeline.
CREATE TABLE IF NOT EXISTS lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(id),
    activity_type TEXT NOT NULL, -- 'whatsapp_reply', 'incoming_call', 'outgoing_call', 'no_reply', 'note', etc.
    channel TEXT, -- 'whatsapp', 'call', 'sms', 'other'
    title TEXT,
    summary TEXT,
    ai_summary TEXT,
    sentiment TEXT, -- 'positive', 'neutral', 'confused', 'frustrated', 'angry'
    intent TEXT,
    outcome TEXT,
    next_action TEXT,
    suggested_reply TEXT,
    follow_up_due_at TIMESTAMPTZ,
    priority_score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Activity Attachments (Screenshots)
CREATE TABLE IF NOT EXISTS activity_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES lead_activities(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Pending Activities
-- Tracks leads that are 'Awaiting Reply' or 'Follow-up Due'
CREATE TABLE IF NOT EXISTS pending_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(id),
    source_activity_id UUID REFERENCES lead_activities(id),
    channel TEXT,
    status TEXT DEFAULT 'awaiting_reply_log',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_action_at TIMESTAMPTZ DEFAULT NOW(),
    follow_up_due_at TIMESTAMPTZ,
    awaiting_reply_log BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. WhatsApp Sessions
-- Specifically for tracking when an agent opens a wa.me link
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(id),
    phone_number TEXT NOT NULL,
    reason_for_contact TEXT,
    suggested_message TEXT,
    final_message TEXT,
    status TEXT DEFAULT 'opened_whatsapp',
    awaiting_reply BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_action_at TIMESTAMPTZ DEFAULT NOW(),
    follow_up_due_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Follow-up Tasks
CREATE TABLE IF NOT EXISTS follow_up_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES users(id),
    source_event_id UUID,
    source_session_id UUID,
    task_type TEXT,
    title TEXT,
    description TEXT,
    due_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Clear mock data from existing tables
-- Deleting existing activity data to start fresh as requested.
TRUNCATE contact_timeline RESTART IDENTITY CASCADE;
TRUNCATE call_logs RESTART IDENTITY CASCADE;
TRUNCATE agent_activity RESTART IDENTITY CASCADE;
TRUNCATE lead_events RESTART IDENTITY CASCADE;
UPDATE leads SET 
    next_action = NULL, 
    next_action_due = NULL, 
    last_contact_at = NULL, 
    last_crm_contact_at = NULL,
    has_pending_action = FALSE,
    pending_action_type = NULL,
    priority_score = 0;

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON lead_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_activities_agent ON pending_activities(agent_id) WHERE status = 'awaiting_reply_log';
CREATE INDEX IF NOT EXISTS idx_leads_priority_score ON leads(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_due ON leads(follow_up_due_at);
CREATE INDEX IF NOT EXISTS idx_leads_has_pending ON leads(has_pending_action) WHERE has_pending_action = TRUE;
