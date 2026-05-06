-- 003_crm_sync_tracking.sql
-- Add tables for CRM sync tracking and history

-- CRM Sync History (track all syncs)
CREATE TABLE IF NOT EXISTS crm_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_integration_id UUID NOT NULL REFERENCES crm_integrations(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  leads_count INT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'partial', 'failed')),
  error TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE crm_sync_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "users_can_view_own_sync_history" ON crm_sync_history FOR SELECT
  USING (owner_email = auth.jwt()->>'email');

-- Indexes for performance
CREATE INDEX idx_crm_sync_history_integration ON crm_sync_history(crm_integration_id);
CREATE INDEX idx_crm_sync_history_owner ON crm_sync_history(owner_email);
CREATE INDEX idx_crm_sync_history_synced_at ON crm_sync_history(synced_at DESC);
