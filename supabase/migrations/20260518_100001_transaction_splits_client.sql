ALTER TABLE transaction_splits
  ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
