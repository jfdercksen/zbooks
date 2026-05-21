-- Standard South African Chart of Accounts seed
-- Run this after creating an organisation to populate default accounts
-- Usage: call seed_default_accounts(organisation_id) from application code

CREATE OR REPLACE FUNCTION seed_default_accounts(p_organisation_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO accounts (organisation_id, code, name, type, vat_type) VALUES
    -- INCOME
    (p_organisation_id, '4000', 'Sales Revenue',              'income',  'standard'),
    (p_organisation_id, '4001', 'Service Income',             'income',  'standard'),
    (p_organisation_id, '4002', 'Other Income',               'income',  'none'),
    (p_organisation_id, '4003', 'Interest Income',            'income',  'exempt'),
    (p_organisation_id, '4004', 'Rental Income',              'income',  'standard'),
    -- EXPENSES — Operating
    (p_organisation_id, '5000', 'Cost of Sales',              'expense', 'standard'),
    (p_organisation_id, '5100', 'Salaries and Wages',         'expense', 'none'),
    (p_organisation_id, '5101', 'PAYE',                       'expense', 'none'),
    (p_organisation_id, '5102', 'UIF — Employer',             'expense', 'none'),
    (p_organisation_id, '5103', 'SDL',                        'expense', 'none'),
    (p_organisation_id, '5200', 'Rent',                       'expense', 'standard'),
    (p_organisation_id, '5201', 'Electricity and Water',      'expense', 'standard'),
    (p_organisation_id, '5202', 'Telephone and Internet',     'expense', 'standard'),
    (p_organisation_id, '5203', 'Office Supplies',            'expense', 'standard'),
    (p_organisation_id, '5300', 'Fuel and Motor',             'expense', 'standard'),
    (p_organisation_id, '5301', 'Travel and Accommodation',   'expense', 'standard'),
    (p_organisation_id, '5400', 'Advertising and Marketing',  'expense', 'standard'),
    (p_organisation_id, '5401', 'Website and Software',       'expense', 'standard'),
    (p_organisation_id, '5500', 'Bank Charges',               'expense', 'exempt'),
    (p_organisation_id, '5501', 'Interest Expense',           'expense', 'exempt'),
    (p_organisation_id, '5600', 'Professional Fees',          'expense', 'standard'),
    (p_organisation_id, '5601', 'Accounting Fees',            'expense', 'standard'),
    (p_organisation_id, '5700', 'Insurance',                  'expense', 'exempt'),
    (p_organisation_id, '5800', 'Repairs and Maintenance',    'expense', 'standard'),
    (p_organisation_id, '5900', 'Depreciation',               'expense', 'none'),
    (p_organisation_id, '5999', 'Miscellaneous Expense',      'expense', 'standard'),
    -- ASSETS
    (p_organisation_id, '1000', 'Current Account',           'asset',   'none'),
    (p_organisation_id, '1001', 'Savings Account',           'asset',   'none'),
    (p_organisation_id, '1100', 'Accounts Receivable',       'asset',   'none'),
    (p_organisation_id, '1200', 'Inventory',                 'asset',   'none'),
    (p_organisation_id, '1500', 'Fixed Assets',              'asset',   'none'),
    -- LIABILITIES
    (p_organisation_id, '2000', 'Accounts Payable',          'liability','none'),
    (p_organisation_id, '2100', 'VAT Payable',               'liability','none'),
    (p_organisation_id, '2200', 'PAYE Payable',              'liability','none'),
    (p_organisation_id, '2300', 'Loan — Short Term',         'liability','none'),
    (p_organisation_id, '2400', 'Loan — Long Term',          'liability','none'),
    -- EQUITY
    (p_organisation_id, '3000', 'Share Capital',             'equity',   'none'),
    (p_organisation_id, '3100', 'Retained Earnings',         'equity',   'none'),
    (p_organisation_id, '3200', "Owner''s Drawings",         'equity',   'none')
  ON CONFLICT (organisation_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
