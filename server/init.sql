-- ============================================================
-- BangBet Dialer - PostgreSQL Database Schema
-- Run this once to initialize the database
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user', 'management', 'agent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- USERS (replaces Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    rejected BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT DEFAULT 'offline',
    manager_id UUID REFERENCES profiles(id),
    current_call_start TIMESTAMPTZ,
    last_status_change TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    target_segment TEXT,
    target_calls INTEGER,
    target_conversions INTEGER,
    total_calls INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_deposits NUMERIC DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    ai_script TEXT,
    suggestions JSONB,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    campaign_id UUID REFERENCES campaigns(id),
    campaign TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    segment TEXT NOT NULL DEFAULT 'general',
    priority TEXT NOT NULL DEFAULT 'medium',
    score INTEGER,
    lead_score INTEGER,
    lifetime_value NUMERIC,
    deposit_count INTEGER,
    preferred_product TEXT,
    trait TEXT,
    betting_patterns JSONB,
    analysis_notes TEXT,
    intent TEXT,
    tags TEXT[],
    last_bet_date DATE,
    last_deposit_ugx NUMERIC,
    last_activity TEXT,
    last_contact_at TIMESTAMPTZ,
    next_action TEXT,
    next_action_due TIMESTAMPTZ,
    sla_minutes INTEGER,
    assigned_by UUID,
    assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CALL ACTIVITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS call_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    campaign_id UUID REFERENCES campaigns(id),
    phone_number TEXT,
    lead_name TEXT,
    call_type TEXT,
    status TEXT,
    duration_seconds INTEGER,
    deposit_amount NUMERIC,
    notes TEXT,
    recording_url TEXT,
    transcript TEXT,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CALLBACKS
-- ============================================================
CREATE TABLE IF NOT EXISTS callbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    lead_name TEXT NOT NULL,
    phone_number TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    scheduled_for TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DAILY METRICS
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL,
    calls_made INTEGER DEFAULT 0,
    connects INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    callbacks_due INTEGER DEFAULT 0,
    total_handle_time_seconds INTEGER DEFAULT 0,
    total_deposit_value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WHATSAPP CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES users(id),
    contact_phone TEXT NOT NULL,
    contact_name TEXT,
    phone_number_id TEXT,
    display_phone_number TEXT,
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WHATSAPP MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    whatsapp_message_id TEXT,
    content TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    media_type TEXT,
    media_url TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AGENT WHATSAPP CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_whatsapp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    phone_number TEXT NOT NULL,
    phone_number_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_call_activities_user_id ON call_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_call_activities_created_at ON call_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_callbacks_user_id ON callbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_date ON daily_metrics(user_id, date);

-- ============================================================
-- FUNCTION: get_agent_monitor_data
-- ============================================================
CREATE OR REPLACE FUNCTION get_agent_monitor_data(manager_filter UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    email TEXT,
    status TEXT,
    manager_id UUID,
    current_call_start TIMESTAMPTZ,
    last_status_change TIMESTAMPTZ,
    calls_today BIGINT,
    assigned_leads BIGINT,
    last_campaign_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.full_name,
        p.email,
        p.status,
        p.manager_id,
        p.current_call_start,
        p.last_status_change,
        COUNT(DISTINCT ca.id) FILTER (WHERE ca.created_at::date = CURRENT_DATE) AS calls_today,
        COUNT(DISTINCT l.id) AS assigned_leads,
        (SELECT c.name FROM campaigns c
         JOIN call_activities ca2 ON ca2.campaign_id = c.id
         WHERE ca2.user_id = p.id ORDER BY ca2.created_at DESC LIMIT 1) AS last_campaign_name
    FROM profiles p
    LEFT JOIN call_activities ca ON ca.user_id = p.id
    LEFT JOIN leads l ON l.user_id = p.id
    WHERE (manager_filter IS NULL OR p.manager_id = manager_filter)
    GROUP BY p.id, p.full_name, p.email, p.status, p.manager_id,
             p.current_call_start, p.last_status_change;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ADD MISSING COLUMNS (safe for existing databases)
-- ============================================================
DO $$ BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS lifetime_value NUMERIC;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS deposit_count INTEGER;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_product TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS betting_patterns JSONB;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS analysis_notes TEXT;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score);

-- ============================================================
-- SEED: Default admin user
-- Password: Admin@BangBet2026! (change after first login)
-- ============================================================
INSERT INTO users (id, email, password_hash) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'admin@bangbet.com',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHui'  -- Admin@BangBet2026!
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO profiles (id, full_name, email, approved) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    'System Admin',
    'admin@bangbet.com',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role) VALUES
('00000000-0000-0000-0000-000000000001', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
