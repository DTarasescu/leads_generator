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
  FOR ALL USING (owner_email = current_user_email());

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
  FOR ALL USING (owner_email = current_user_email());

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
  FOR ALL USING (owner_email = current_user_email());

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
    batch_id IN (SELECT id FROM outreach_batches WHERE owner_email = current_user_email())
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
  FOR ALL USING (owner_email = current_user_email());

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
  FOR SELECT USING (owner_email = current_user_email());

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
  FOR SELECT USING (owner_email = current_user_email());
