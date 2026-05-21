-- Fix VAT types on standard chart-of-accounts entries that are VAT-exempt in SA law:
-- Insurance (5700): VAT-exempt per SA VAT Act s12(a)
-- Bank Charges (5500): VAT-exempt per SA VAT Act s2(1)(f) financial services

UPDATE accounts
SET vat_type = 'exempt'
WHERE code IN ('5500', '5700')
  AND vat_type = 'standard'
  AND name ILIKE ANY (ARRAY['%insurance%', '%bank charge%', '%bank fee%', '%bank charges%', '%bank fees%']);
