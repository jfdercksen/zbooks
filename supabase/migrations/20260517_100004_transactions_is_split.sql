-- Migration: 20260517_100004_transactions_is_split.sql
-- Description: Add is_split and allocated_organisation_id to transactions
-- Date: 2026-05-17

-- is_split: true when this transaction has legs in transaction_splits
ALTER TABLE transactions
  ADD COLUMN is_split BOOLEAN NOT NULL DEFAULT false;

-- allocated_organisation_id: which subsidiary owns this transaction
-- NULL = belongs to the bank account's org (the holding company)
-- Set = assigned to a specific subsidiary (not split — 100% theirs)
ALTER TABLE transactions
  ADD COLUMN allocated_organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_is_split ON transactions(is_split);
CREATE INDEX idx_transactions_allocated_org ON transactions(allocated_organisation_id);

COMMENT ON COLUMN transactions.is_split IS 'True when the transaction is divided across multiple organisations via transaction_splits.';
COMMENT ON COLUMN transactions.allocated_organisation_id IS 'Subsidiary this transaction belongs to. NULL = holding company or unallocated.';
