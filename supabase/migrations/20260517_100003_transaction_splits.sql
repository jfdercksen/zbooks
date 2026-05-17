-- Migration: 20260517_100003_transaction_splits.sql
-- Description: Create transaction_splits table for multi-org transaction allocation
-- Date: 2026-05-17

CREATE TABLE transaction_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  percentage DECIMAL(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  vat_type TEXT NOT NULL DEFAULT 'standard',
  vat_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  -- Flags this leg for elimination in consolidated group reports
  is_intercompany BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transaction_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX idx_transaction_splits_organisation_id ON transaction_splits(organisation_id);

ALTER TABLE transaction_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transaction_splits_select" ON transaction_splits
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "transaction_splits_insert" ON transaction_splits
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "transaction_splits_update" ON transaction_splits
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "transaction_splits_delete" ON transaction_splits
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON TABLE transaction_splits IS 'Legs of a split transaction — one row per org that shares the transaction.';
COMMENT ON COLUMN transaction_splits.is_intercompany IS 'True when both sides of the split are within the same group. Excluded from consolidated P&L.';
