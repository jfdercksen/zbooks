-- Migration: 20260517_100000_org_hierarchy.sql
-- Description: Add parent_organisation_id to organisations for holding company structure
-- Date: 2026-05-17

ALTER TABLE organisations
  ADD COLUMN parent_organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL;

CREATE INDEX idx_organisations_parent_id ON organisations(parent_organisation_id);

COMMENT ON COLUMN organisations.parent_organisation_id IS 'Links subsidiary to parent/holding company. NULL = top-level entity.';
