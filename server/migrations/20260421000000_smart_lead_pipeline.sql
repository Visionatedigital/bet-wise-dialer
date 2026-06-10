-- ============================================================
-- Smart Lead Pipeline: enrichment tracking, cooldowns, history
-- ============================================================

-- Extend leads with tracking columns
DO $$ BEGIN
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_imported_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS import_count INTEGER DEFAULT 1;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS pre_call_snapshot JSONB;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS attributed_deposit_ugx NUMERIC DEFAULT 0;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS recycled_from_dead_at TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_leads_last_enriched_at ON leads(last_enriched_at);
CREATE INDEX IF NOT EXISTS idx_leads_cooldown_until ON leads(cooldown_until);
CREATE INDEX IF NOT EXISTS idx_leads_lifecycle_stage ON leads(lifecycle_stage);

-- Lead events: full history of every significant state change on a lead
CREATE TABLE IF NOT EXISTS lead_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL,
    -- Types: imported, enriched, called, assigned, disposition, converted, recycled, cooldown_set
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON lead_events(event_type, created_at DESC);

-- Import batches: track each import operation for summary stats
CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    batch_type TEXT NOT NULL, -- 'new_leads' or 'performance_refresh'
    source_filename TEXT,
    total_rows INTEGER DEFAULT 0,
    new_count INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    recycled_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    upgraded_count INTEGER DEFAULT 0,
    downgraded_count INTEGER DEFAULT 0,
    converted_count INTEGER DEFAULT 0,
    attributed_deposit_ugx NUMERIC DEFAULT 0,
    summary JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user ON import_batches(user_id, created_at DESC);
