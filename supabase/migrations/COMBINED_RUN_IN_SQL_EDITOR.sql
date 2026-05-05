-- Migration 001: Initial schema for leads-generator
-- Run this in the Supabase SQL Editor

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Leads table
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS leads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email       text NOT NULL,
  name              text NOT NULL,
  email             text,
  phone             text,
  business_type     text,
  city              text,
  country           text,
  website           text,
  google_place_id   text,
  google_rating     numeric(3,1),
  google_review_count int,
  ai_score          int CHECK (ai_score BETWEEN 0 AND 100),
  ai_score_reason   text,
  status            text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','contacted','qualified','converted','rejected')),
  source            text NOT NULL DEFAULT 'manual',
  outreach_message  text,
  last_contacted_at timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Row Level Security
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_owner_select" ON leads
  FOR SELECT USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "leads_owner_insert" ON leads
  FOR INSERT WITH CHECK (owner_email = auth.jwt()->>'email');

CREATE POLICY "leads_owner_update" ON leads
  FOR UPDATE USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "leads_owner_delete" ON leads
  FOR DELETE USING (owner_email = auth.jwt()->>'email');

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Outreach history table
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE TABLE IF NOT EXISTS lead_outreach_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid REFERENCES leads(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  channel     text NOT NULL CHECK (channel IN ('email','whatsapp','copy')),
  message     text NOT NULL,
  sent_at     timestamptz DEFAULT now()
);

ALTER TABLE lead_outreach_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outreach_owner_select" ON lead_outreach_history
  FOR SELECT USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "outreach_owner_insert" ON lead_outreach_history
  FOR INSERT WITH CHECK (owner_email = auth.jwt()->>'email');
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
-- Migration: 003_additional_lead_generation_tools
-- Adds tables for advanced lead generation features

-- Referral leads tracking
CREATE TABLE IF NOT EXISTS referral_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  referrer_email TEXT NOT NULL,
  referred_email TEXT NOT NULL UNIQUE,
  incentive_type TEXT CHECK (incentive_type IN ('credit', 'discount', 'feature_unlock')),
  incentive_value INTEGER DEFAULT 50,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'converted')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_referral_leads_owner ON referral_leads(owner_email);
CREATE INDEX idx_referral_leads_referred_email ON referral_leads(referred_email);

ALTER TABLE referral_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own referrals" ON referral_leads
  FOR ALL USING (owner_email = auth.jwt()->>'email');

-- Event registration tracking
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('webinar', 'workshop', 'conference', 'meetup', 'summit')),
  event_date DATE,
  total_registrants INTEGER DEFAULT 0,
  imported_leads INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_owner ON events(owner_email);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON events
  FOR ALL USING (owner_email = auth.jwt()->>'email');

-- Outreach batch tracking
CREATE TABLE IF NOT EXISTS outreach_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  channel TEXT CHECK (channel IN ('email', 'sms', 'whatsapp', 'sequence_enrollment')),
  template_id UUID,
  total_leads INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_outreach_batches_owner ON outreach_batches(owner_email);
CREATE INDEX idx_outreach_batches_status ON outreach_batches(status);

ALTER TABLE outreach_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own batches" ON outreach_batches
  FOR ALL USING (owner_email = auth.jwt()->>'email');

-- Outreach task queue
CREATE TABLE IF NOT EXISTS outreach_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES outreach_batches(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  template_id UUID,
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_outreach_tasks_batch ON outreach_tasks(batch_id);
CREATE INDEX idx_outreach_tasks_lead ON outreach_tasks(lead_id);
CREATE INDEX idx_outreach_tasks_scheduled ON outreach_tasks(scheduled_for);
CREATE INDEX idx_outreach_tasks_status ON outreach_tasks(status);

ALTER TABLE outreach_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tasks are accessible via batch owner" ON outreach_tasks
  FOR SELECT USING (
    batch_id IN (SELECT id FROM outreach_batches WHERE owner_email = auth.jwt()->>'email')
  );

-- Saved lead lists
CREATE TABLE IF NOT EXISTS saved_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  list_name TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  lead_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(owner_email, list_name)
);

CREATE INDEX idx_saved_lists_owner ON saved_lists(owner_email);

ALTER TABLE saved_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own lists" ON saved_lists
  FOR ALL USING (owner_email = auth.jwt()->>'email');

-- Lead intent signals (for behavioral tracking)
CREATE TABLE IF NOT EXISTS lead_intent_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  owner_email TEXT NOT NULL,
  signal_type TEXT NOT NULL CHECK (
    signal_type IN ('website_visit', 'email_open', 'link_click', 'form_submission', 'page_view', 'content_download')
  ),
  signal_data JSONB DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_intent_signals_lead ON lead_intent_signals(lead_id);
CREATE INDEX idx_intent_signals_owner ON lead_intent_signals(owner_email);
CREATE INDEX idx_intent_signals_type ON lead_intent_signals(signal_type);

ALTER TABLE lead_intent_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own signals" ON lead_intent_signals
  FOR SELECT USING (owner_email = auth.jwt()->>'email');

-- API usage tracking (for quota management)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_email TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_usage_owner_date ON api_usage(owner_email, created_at);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON api_usage
  FOR SELECT USING (owner_email = auth.jwt()->>'email');
-- Migration 004: New tools schema
-- A/B test message variants
CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::json->>'email',
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  goal TEXT,
  segment_filters JSONB,
  variants JSONB NOT NULL DEFAULT '[]',
  winner_variant INT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'concluded', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ab_tests owner access" ON ab_tests
  FOR ALL USING (owner_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Voice call logs
CREATE TABLE IF NOT EXISTS voice_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  owner_email TEXT NOT NULL,
  call_sid TEXT,
  to_number TEXT,
  from_number TEXT,
  duration_seconds INT,
  status TEXT, -- 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer'
  script_type TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE voice_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_call_logs owner access" ON voice_call_logs
  FOR ALL USING (owner_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Chat widget sessions (for conversation history)
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  owner_email TEXT NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  captured_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_sessions owner access" ON chat_sessions
  FOR ALL USING (owner_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Add lat/lng columns to leads table if not present
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lat FLOAT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lng FLOAT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website TEXT;

-- Add unique constraint on website for product-hunt-leads upsert
CREATE UNIQUE INDEX IF NOT EXISTS leads_website_unique
  ON leads (website) WHERE website IS NOT NULL;



