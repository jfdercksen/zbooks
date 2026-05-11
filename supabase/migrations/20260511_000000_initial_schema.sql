-- Z-Books Initial Schema
-- Phase 0 — Complete database schema with RLS and audit triggers

-- ============================================================
-- SHARED HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ORGANISATIONS
-- ============================================================

CREATE TABLE organisations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  registration_number  TEXT,
  vat_number           TEXT,
  financial_year_start INTEGER NOT NULL DEFAULT 3,  -- March (month number)
  financial_year_end   INTEGER NOT NULL DEFAULT 2,  -- February
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER organisations_updated_at
  BEFORE UPDATE ON organisations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Users can only see organisations they belong to
CREATE POLICY "organisations_select" ON organisations
  FOR SELECT USING (
    id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "organisations_insert" ON organisations
  FOR INSERT WITH CHECK (true);  -- Any authenticated user can create an org (they become admin)

CREATE POLICY "organisations_update" ON organisations
  FOR UPDATE USING (
    id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "organisations_delete" ON organisations
  FOR DELETE USING (
    id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- ORGANISATION MEMBERS (user ↔ organisation relationship)
-- ============================================================

CREATE TABLE organisation_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, user_id)
);

CREATE INDEX idx_organisation_members_organisation_id ON organisation_members(organisation_id);
CREATE INDEX idx_organisation_members_user_id ON organisation_members(user_id);

ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organisation_members_select" ON organisation_members
  FOR SELECT USING (user_id = auth.uid() OR organisation_id IN (
    SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "organisation_members_insert" ON organisation_members
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    OR user_id = auth.uid()  -- Allow self-insert (becoming member of new org)
  );

CREATE POLICY "organisation_members_update" ON organisation_members
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "organisation_members_delete" ON organisation_members
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- BANK ACCOUNTS
-- ============================================================

CREATE TABLE bank_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  bank_name        TEXT NOT NULL,
  account_number   TEXT,
  account_type     TEXT NOT NULL DEFAULT 'cheque' CHECK (account_type IN ('cheque', 'savings', 'credit', 'investment')),
  currency         TEXT NOT NULL DEFAULT 'ZAR',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_organisation_id ON bank_accounts(organisation_id);

CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_select" ON bank_accounts
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "bank_accounts_insert" ON bank_accounts
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "bank_accounts_update" ON bank_accounts
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "bank_accounts_delete" ON bank_accounts
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================

CREATE TABLE accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('income', 'expense', 'asset', 'liability', 'equity')),
  vat_type         TEXT NOT NULL DEFAULT 'none' CHECK (vat_type IN ('standard', 'zero_rated', 'exempt', 'none')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, code)
);

CREATE INDEX idx_accounts_organisation_id ON accounts(organisation_id);

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select" ON accounts
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "accounts_insert" ON accounts
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "accounts_update" ON accounts
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "accounts_delete" ON accounts
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- BANK STATEMENTS (uploaded PDFs)
-- ============================================================

CREATE TABLE bank_statements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  bank_account_id       UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  file_name             TEXT NOT NULL,
  file_path             TEXT NOT NULL,
  statement_date_from   DATE,
  statement_date_to     DATE,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processing', 'review', 'committed', 'failed')),
  uploaded_by           UUID NOT NULL REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_statements_organisation_id ON bank_statements(organisation_id);
CREATE INDEX idx_bank_statements_bank_account_id ON bank_statements(bank_account_id);

CREATE TRIGGER bank_statements_updated_at
  BEFORE UPDATE ON bank_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_statements_select" ON bank_statements
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "bank_statements_insert" ON bank_statements
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "bank_statements_update" ON bank_statements
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "bank_statements_delete" ON bank_statements
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- TRANSACTIONS (the main financial ledger)
-- ============================================================

CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  bank_account_id   UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  bank_statement_id UUID REFERENCES bank_statements(id) ON DELETE SET NULL,
  date              DATE NOT NULL,
  description       TEXT NOT NULL,
  debit_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit_amount     DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance           DECIMAL(15,2),
  account_id        UUID REFERENCES accounts(id) ON DELETE SET NULL,
  vat_type          TEXT NOT NULL DEFAULT 'none' CHECK (vat_type IN ('standard', 'zero_rated', 'exempt', 'none')),
  vat_amount        DECIMAL(15,2) NOT NULL DEFAULT 0,
  reference         TEXT,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'categorised', 'committed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_organisation_id ON transactions(organisation_id);
CREATE INDEX idx_transactions_bank_account_id ON transactions(bank_account_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_status ON transactions(status);

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "transactions_insert" ON transactions
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "transactions_update" ON transactions
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "transactions_delete" ON transactions
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- EMPLOYEES
-- ============================================================

CREATE TABLE employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  id_number         TEXT,
  email             TEXT,
  start_date        DATE NOT NULL,
  employment_type   TEXT NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'contract')),
  gross_salary      DECIMAL(15,2) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_organisation_id ON employees(organisation_id);

CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_select" ON employees
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "employees_insert" ON employees
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "employees_update" ON employees
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "employees_delete" ON employees
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- PAYROLL RUNS
-- ============================================================

CREATE TABLE payroll_runs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  period_month         INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year          INTEGER NOT NULL,
  total_gross          DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_paye           DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_uif_employee   DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_uif_employer   DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_sdl            DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_net            DECIMAL(15,2) NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalised')),
  created_by           UUID NOT NULL REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, period_month, period_year)
);

CREATE INDEX idx_payroll_runs_organisation_id ON payroll_runs(organisation_id);

CREATE TRIGGER payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_runs_select" ON payroll_runs
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "payroll_runs_insert" ON payroll_runs
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "payroll_runs_update" ON payroll_runs
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "payroll_runs_delete" ON payroll_runs
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- PAYROLL ENTRIES (one row per employee per run)
-- ============================================================

CREATE TABLE payroll_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  payroll_run_id   UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  gross_salary     DECIMAL(15,2) NOT NULL,
  paye             DECIMAL(15,2) NOT NULL,
  uif_employee     DECIMAL(15,2) NOT NULL,
  uif_employer     DECIMAL(15,2) NOT NULL,
  sdl              DECIMAL(15,2) NOT NULL,
  net_pay          DECIMAL(15,2) NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payroll_entries_organisation_id ON payroll_entries(organisation_id);
CREATE INDEX idx_payroll_entries_payroll_run_id ON payroll_entries(payroll_run_id);

ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payroll_entries_select" ON payroll_entries
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "payroll_entries_insert" ON payroll_entries
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "payroll_entries_delete" ON payroll_entries
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- AUDIT LOG (immutable — no UPDATE or DELETE policy)
-- ============================================================

CREATE TABLE audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL,  -- No FK — audit log must survive org deletion
  user_id          UUID,
  table_name       TEXT NOT NULL,
  record_id        UUID NOT NULL,
  action           TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data         JSONB,
  new_data         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_organisation_id ON audit_log(organisation_id);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT only via trigger — no direct insert by users
-- No UPDATE or DELETE policies — audit log is immutable

-- ============================================================
-- AUDIT LOG TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION write_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_organisation_id UUID;
  v_record_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_organisation_id := OLD.organisation_id;
    v_record_id := OLD.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_organisation_id := NEW.organisation_id;
    v_record_id := NEW.id;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSE
    v_organisation_id := NEW.organisation_id;
    v_record_id := NEW.id;
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_log (organisation_id, user_id, table_name, record_id, action, old_data, new_data)
  VALUES (v_organisation_id, auth.uid(), TG_TABLE_NAME, v_record_id, TG_OP, v_old_data, v_new_data);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to financial tables
CREATE TRIGGER transactions_audit
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER bank_statements_audit
  AFTER INSERT OR UPDATE OR DELETE ON bank_statements
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER payroll_runs_audit
  AFTER INSERT OR UPDATE OR DELETE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

CREATE TRIGGER payroll_entries_audit
  AFTER INSERT OR UPDATE OR DELETE ON payroll_entries
  FOR EACH ROW EXECUTE FUNCTION write_audit_log();

-- ============================================================
-- STORAGE BUCKET for PDF bank statements
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bank-statements',
  'bank-statements',
  FALSE,
  10485760,  -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bank_statements_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'bank-statements'
    AND (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "bank_statements_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bank-statements'
    AND (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "bank_statements_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'bank-statements'
    AND (storage.foldername(name))[1] IN (
      SELECT organisation_id::text FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
