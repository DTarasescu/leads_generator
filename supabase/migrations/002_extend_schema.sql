-- 002_extend_schema.sql
-- Add tables for advanced features: templates, sequences, CRM configs, analytics

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  subject_line TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT ARRAY[]::TEXT[], -- placeholders like {{name}}, {{business_type}}
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, name)
);

-- SMS Templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, name)
);

-- Nurture Sequences
CREATE TABLE IF NOT EXISTS nurture_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')), -- or multi-channel
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sequence Steps (ordered steps within a sequence)
CREATE TABLE IF NOT EXISTS sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES nurture_sequences(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  delay_hours INT DEFAULT 24, -- hours after previous step
  template_type TEXT NOT NULL CHECK (template_type IN ('email', 'sms', 'whatsapp')),
  template_id UUID,
  custom_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_id, step_number)
);

-- Lead Sequence Progress Tracking
CREATE TABLE IF NOT EXISTS lead_sequence_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES nurture_sequences(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  current_step INT DEFAULT 0,
  last_step_sent_at TIMESTAMPTZ,
  next_step_scheduled_at TIMESTAMPTZ,
  is_completed BOOLEAN DEFAULT FALSE,
  is_paused BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, sequence_id)
);

-- Lead Scoring Rules (for rule-based + AI hybrid scoring)
CREATE TABLE IF NOT EXISTS lead_scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('business_type', 'location', 'website', 'reviews', 'rating')),
  condition_value TEXT NOT NULL, -- e.g., "contains gym", "country=Romania", "rating>=4.5"
  score_adjustment INT DEFAULT 10, -- points to add/subtract
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRM Configurations
CREATE TABLE IF NOT EXISTS crm_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  crm_type TEXT NOT NULL CHECK (crm_type IN ('pipedrive', 'hubspot', 'salesforce')),
  api_key TEXT NOT NULL,
  api_url TEXT,
  workspace_id TEXT, -- for HubSpot
  org_id TEXT, -- for Salesforce
  is_active BOOLEAN DEFAULT TRUE,
  auto_sync BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, crm_type)
);

-- Lead CRM Sync Status
CREATE TABLE IF NOT EXISTS lead_crm_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  crm_integration_id UUID NOT NULL REFERENCES crm_integrations(id) ON DELETE CASCADE,
  external_id TEXT, -- Pipedrive deal ID, HubSpot contact ID, etc.
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  last_sync_at TIMESTAMPTZ,
  sync_error_message TEXT
);

-- Analytics/Metrics Cache
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL,
  metric_date DATE DEFAULT CURRENT_DATE,
  total_leads INT DEFAULT 0,
  leads_contacted INT DEFAULT 0,
  leads_qualified INT DEFAULT 0,
  leads_converted INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  sms_sent INT DEFAULT 0,
  whatsapp_sent INT DEFAULT 0,
  avg_lead_score FLOAT,
  conversion_rate FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_email, metric_date)
);

-- Enable RLS for all new tables
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE nurture_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sequence_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_crm_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies (owner_email = auth email)
CREATE POLICY "users_can_view_own_email_templates" ON email_templates FOR SELECT
  USING (owner_email = auth.jwt()->>'email');
CREATE POLICY "users_can_manage_own_email_templates" ON email_templates FOR ALL
  USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "users_can_view_own_sms_templates" ON sms_templates FOR SELECT
  USING (owner_email = auth.jwt()->>'email');
CREATE POLICY "users_can_manage_own_sms_templates" ON sms_templates FOR ALL
  USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "users_can_view_own_sequences" ON nurture_sequences FOR SELECT
  USING (owner_email = auth.jwt()->>'email');
CREATE POLICY "users_can_manage_own_sequences" ON nurture_sequences FOR ALL
  USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "users_can_view_own_sequence_steps" ON sequence_steps FOR SELECT
  USING (sequence_id IN (SELECT id FROM nurture_sequences WHERE owner_email = auth.jwt()->>'email'));
CREATE POLICY "users_can_manage_own_sequence_steps" ON sequence_steps FOR ALL
  USING (sequence_id IN (SELECT id FROM nurture_sequences WHERE owner_email = auth.jwt()->>'email'));

CREATE POLICY "users_can_view_own_lead_sequence_progress" ON lead_sequence_progress FOR SELECT
  USING (owner_email = auth.jwt()->>'email');
CREATE POLICY "users_can_manage_own_lead_sequence_progress" ON lead_sequence_progress FOR ALL
  USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "users_can_view_own_scoring_rules" ON lead_scoring_rules FOR SELECT
  USING (owner_email = auth.jwt()->>'email');
CREATE POLICY "users_can_manage_own_scoring_rules" ON lead_scoring_rules FOR ALL
  USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "users_can_view_own_crm_integrations" ON crm_integrations FOR SELECT
  USING (owner_email = auth.jwt()->>'email');
CREATE POLICY "users_can_manage_own_crm_integrations" ON crm_integrations FOR ALL
  USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "users_can_view_own_crm_sync_status" ON lead_crm_sync_status FOR SELECT
  USING (lead_id IN (SELECT id FROM leads WHERE owner_email = auth.jwt()->>'email'));
CREATE POLICY "users_can_manage_own_crm_sync_status" ON lead_crm_sync_status FOR ALL
  USING (lead_id IN (SELECT id FROM leads WHERE owner_email = auth.jwt()->>'email'));

CREATE POLICY "users_can_view_own_analytics" ON analytics_metrics FOR SELECT
  USING (owner_email = auth.jwt()->>'email');
