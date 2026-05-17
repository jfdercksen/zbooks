-- Migration: 20260517_100002_allocation_rules.sql
-- Description: Create allocation_rules table for learned transaction split patterns
-- Date: 2026-05-17

CREATE TABLE allocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description_pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact', 'starts_with')),
  transaction_type TEXT NOT NULL DEFAULT 'both' CHECK (transaction_type IN ('debit', 'credit', 'both')),
  -- splits: [{organisation_id, organisation_name, account_id, account_name, percentage}]
  splits JSONB NOT NULL DEFAULT '[]',
  is_intercompany BOOLEAN NOT NULL DEFAULT false,
  times_applied INT NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_allocation_rules_user_id ON allocation_rules(user_id);

ALTER TABLE allocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allocation_rules_select" ON allocation_rules
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "allocation_rules_insert" ON allocation_rules
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "allocation_rules_update" ON allocation_rules
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "allocation_rules_delete" ON allocation_rules
  FOR DELETE USING (user_id = auth.uid());

CREATE TRIGGER update_allocation_rules_updated_at
  BEFORE UPDATE ON allocation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE allocation_rules IS 'AI-learned rules: description pattern → how to split/assign the transaction. Scoped per user, applies across all their organisations.';
COMMENT ON COLUMN allocation_rules.splits IS 'Array of {organisation_id, organisation_name, account_id, account_name, percentage}. Percentages must sum to 100.';
COMMENT ON COLUMN allocation_rules.is_intercompany IS 'True when the split involves two entities within the same group — flagged for consolidated report elimination.';
