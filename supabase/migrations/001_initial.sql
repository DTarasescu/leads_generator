-- Migration 001: Initial schema for leads_generator
-- Run this in the Supabase SQL Editor

-- ─────────────────────────────────────────────
-- Leads table
-- ─────────────────────────────────────────────
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
  source            text NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('manual','csv','discovery','inbound','typeform','jotform')),
  outreach_message  text,
  last_contacted_at timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_owner_select" ON leads
  FOR SELECT USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "leads_owner_insert" ON leads
  FOR INSERT WITH CHECK (owner_email = auth.jwt()->>'email');

CREATE POLICY "leads_owner_update" ON leads
  FOR UPDATE USING (owner_email = auth.jwt()->>'email');

CREATE POLICY "leads_owner_delete" ON leads
  FOR DELETE USING (owner_email = auth.jwt()->>'email');

-- ─────────────────────────────────────────────
-- Outreach history table
-- ─────────────────────────────────────────────
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
