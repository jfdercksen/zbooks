-- Migration: 20260520_100001_org_company_type.sql
-- Description: Add company_type to organisations — drives single vs multi-company UI
-- Date: 2026-05-20

ALTER TABLE organisations
  ADD COLUMN company_type TEXT NOT NULL DEFAULT 'single'
    CHECK (company_type IN ('single', 'multi'));

COMMENT ON COLUMN organisations.company_type IS 'single = standalone company. multi = holding/group entity — enables subsidiary allocation column on statement review.';
