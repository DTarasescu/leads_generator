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
