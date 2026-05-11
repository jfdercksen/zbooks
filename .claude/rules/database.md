# Z-Books — Database Rules
**Scope:** `supabase/migrations/**`, `lib/supabase/**`, `types/database.ts`
**Updated:** May 2026

These rules load automatically when working with database files and Supabase clients.

---

## Migration Rules

1. **Every schema change needs a migration file.** No exceptions.
   - File: `supabase/migrations/YYYYMMDD_HHMMSS_description.sql`
   - Never edit the database via Supabase dashboard SQL editor

2. **Migrations are forward-only.** No rollback scripts in Phase 1.

3. **Timestamp must be accurate** — use `date +"%Y%m%d_%H%M%S"` to generate.

4. **After every migration:**
   ```bash
   npx supabase db push                                              # Apply to production
   npx supabase gen types typescript --linked > types/database.ts  # Regenerate types
   ```

5. **Never delete a migration file** — they are the source of truth for schema history.

## Column Standards

```sql
-- ✅ CORRECT monetary columns
amount          DECIMAL(15,2) NOT NULL DEFAULT 0,
debit_amount    DECIMAL(15,2) NOT NULL DEFAULT 0,
credit_amount   DECIMAL(15,2) NOT NULL DEFAULT 0,
vat_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,

-- ❌ NEVER use these for money
amount          FLOAT,            -- approximate — will cause rounding errors
amount          REAL,             -- approximate
amount          DOUBLE PRECISION, -- approximate
amount          NUMERIC,          -- missing precision — same as DOUBLE PRECISION
```

## Table Requirements Checklist

Every new table must have:
- [ ] `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- [ ] `organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE`
- [ ] `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [ ] `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [ ] `CREATE INDEX idx_[table]_organisation_id ON [table](organisation_id)`
- [ ] `ALTER TABLE [table] ENABLE ROW LEVEL SECURITY`
- [ ] SELECT, INSERT, UPDATE, DELETE RLS policies
- [ ] `updated_at` trigger using `update_updated_at_column()` function
- [ ] Audit log trigger for financial tables

## RLS Pattern — Use This Every Time

```sql
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "[table_name]_select" ON [table_name]
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "[table_name]_insert" ON [table_name]
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "[table_name]_update" ON [table_name]
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

CREATE POLICY "[table_name]_delete" ON [table_name]
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

## Supabase Client — Which to Use

```typescript
// Server Component or API route — ALWAYS use server client
import { createServerClient } from "@/lib/supabase/server"
const supabase = await createServerClient()

// Client Component — ONLY use browser client
import { createBrowserClient } from "@/lib/supabase/client"
const supabase = createBrowserClient()
```

## TypeScript Types

- Types live in `types/database.ts` — auto-generated from schema
- Never manually edit `types/database.ts` — it gets overwritten on `gen types`
- Application-specific types in `types/app.ts` — these can be hand-edited

## Verification Commands

```bash
# Check RLS on all tables
npx supabase db diff --schema public

# Verify locally before pushing
npx supabase db reset

# Check types are in sync
npx tsc --noEmit
```
