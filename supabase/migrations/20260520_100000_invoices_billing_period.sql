ALTER TABLE invoices ADD COLUMN billing_period TEXT CHECK (billing_period ~ '^\d{4}-\d{2}$');
CREATE INDEX idx_invoices_billing_period ON invoices(billing_period);
