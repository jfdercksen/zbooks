---
name: add-supabase-table
description: Add a new database table to Z-Books. Fire when the user says "add table", "new database table", "add schema", "create table", or mentions a new data entity that needs storing. Creates migration file, RLS policies, indexes, and regenerates TypeScript types.
allowed-tools: Read, Write, Edit, Bash
argument-hint: table-name "columns: col1 type, col2 type" "description of purpose"
---

# /add-supabase-table — Z-Books Table Generator

Create a production-ready Supabase table with migration, RLS, and TypeScript types.

## Live Context

Existing migrations:
!`ls supabase/migrations/ 2>/dev/null | sort`

Existing tables (from migrations):
!`grep -h "CREATE TABLE" supabase/migrations/*.sql 2>/dev/null | sed 's/.*CREATE TABLE\s*//' | sed 's/\s.*//'`

Current timestamp:
!`date +"%Y%m%d_%H%M%S"`

## Process

1. Generate timestamp for migration filename
2. Create `supabase/migrations/[timestamp]_create_[table_name].sql`
3. Write complete migration with table, RLS, indexes, triggers
4. Run `npx supabase db push` to apply
5. Run `npx supabase gen types typescript --linked > types/database.ts`
6. Verify types generated correctly

## Migration Template

```sql
-- supabase/migrations/[timestamp]_create_[table_name].sql
-- Z-Books — [Table purpose description]

CREATE TABLE IF NOT EXISTS [table_name] (
  -- Identity
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  
  -- Business columns (all DECIMAL(15,2) for monetary values)
  -- [column_name] [type] NOT NULL DEFAULT [default],
  
  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id)
);

-- Index on organisation_id (always — critical for RLS performance)
CREATE INDEX IF NOT EXISTS idx_[table_name]_organisation_id 
  ON [table_name](organisation_id);

-- Index on commonly filtered columns
-- CREATE INDEX IF NOT EXISTS idx_[table_name]_[column] ON [table_name]([column]);

-- Auto-update updated_at
CREATE TRIGGER update_[table_name]_updated_at
  BEFORE UPDATE ON [table_name]
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit log trigger
CREATE TRIGGER audit_[table_name]
  AFTER INSERT OR UPDATE OR DELETE ON [table_name]
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- SELECT: members of the organisation can read
CREATE POLICY "[table_name]_select" ON [table_name]
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: admin and editor members can insert
CREATE POLICY "[table_name]_insert" ON [table_name]
  FOR INSERT WITH CHECK (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- UPDATE: admin and editor members can update
CREATE POLICY "[table_name]_update" ON [table_name]
  FOR UPDATE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor')
    )
  );

-- DELETE: admin only
CREATE POLICY "[table_name]_delete" ON [table_name]
  FOR DELETE USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

## Rules

1. **Timestamp prefix always** — `YYYYMMDD_HHMMSS_create_[table].sql`
2. **organisation_id on every table** — no exceptions for financial tables
3. **DECIMAL(15,2) for all monetary columns** — never FLOAT
4. **RLS enabled on every table** — four policies minimum (SELECT, INSERT, UPDATE, DELETE)
5. **Index on organisation_id** — always (RLS policy performance)
6. **Audit trigger on all financial tables** — immutable history
7. **Regenerate types after migration** — `npx supabase gen types typescript --linked > types/database.ts`

## Output

```
## Table Created

Migration: supabase/migrations/[timestamp]_create_[table_name].sql
Table: [table_name]
Columns: [list]
RLS policies: 4 (SELECT, INSERT, UPDATE, DELETE)
Indexes: [list]
Audit trigger: ✅
Types regenerated: ✅

Verify with:
npx supabase db diff
```
