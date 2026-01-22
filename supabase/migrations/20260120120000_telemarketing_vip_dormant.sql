-- Telemarketing core tables for Bangbet VIP Dormant campaign

-- Campaigns table: defines telemarketing campaigns such as VIP Dormant
CREATE TABLE IF NOT EXISTS public.telemarketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- e.g. 'VIP_DORMANT'
  name TEXT NOT NULL,        -- e.g. 'VIP Dormant Reactivation'
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB,              -- arbitrary per-campaign configuration
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leads table: one row per player-in-campaign (Kanban card)
CREATE TABLE IF NOT EXISTS public.telemarketing_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.telemarketing_campaigns(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  player_name TEXT,
  vip_level TEXT,
  preferred_product TEXT, -- sportsbook | casino | aviator | etc
  language_preference TEXT,
  timezone TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new', -- new | called_no_answer | call_back_later | interested | deposited | closed | do_not_call
  assigned_agent UUID REFERENCES auth.users(id),
  follow_up_at TIMESTAMPTZ,
  last_outcome TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calls table: individual call attempts associated with a lead
CREATE TABLE IF NOT EXISTS public.telemarketing_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.telemarketing_leads(id) ON DELETE CASCADE,
  call_id TEXT, -- provider call id (e.g. Africa's Talking session id)
  agent_id UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  outcome TEXT, -- matched to lead.status outcome values
  recording_url TEXT,   -- original provider URL (short-lived)
  audio_uri TEXT,       -- internal storage location
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI feedback per call
CREATE TABLE IF NOT EXISTS public.telemarketing_call_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.telemarketing_calls(id) ON DELETE CASCADE,
  script_adherence_score NUMERIC,
  engagement_score NUMERIC,
  conversion_likelihood NUMERIC,
  detected_objections JSONB,
  improvements JSONB,
  raw_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simple indexes for query performance
CREATE INDEX IF NOT EXISTS idx_telemarketing_leads_campaign
  ON public.telemarketing_leads (campaign_id);

CREATE INDEX IF NOT EXISTS idx_telemarketing_leads_assigned_agent
  ON public.telemarketing_leads (assigned_agent);

CREATE INDEX IF NOT EXISTS idx_telemarketing_leads_status_followup
  ON public.telemarketing_leads (status, follow_up_at);

CREATE INDEX IF NOT EXISTS idx_telemarketing_calls_lead
  ON public.telemarketing_calls (lead_id);

CREATE INDEX IF NOT EXISTS idx_telemarketing_calls_agent
  ON public.telemarketing_calls (agent_id);

-- Updated_at trigger function (reuse if already present, else create a minimal one)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'telemarketing_set_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.telemarketing_set_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END;
$$;

CREATE TRIGGER telemarketing_campaigns_set_updated_at
  BEFORE UPDATE ON public.telemarketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.telemarketing_set_updated_at();

CREATE TRIGGER telemarketing_leads_set_updated_at
  BEFORE UPDATE ON public.telemarketing_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.telemarketing_set_updated_at();

