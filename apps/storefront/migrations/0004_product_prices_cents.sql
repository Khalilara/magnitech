-- Standardize stored catalog prices on integer cents, matching order tables.
-- Existing product APIs continue to expose euro amounts to the storefront.

ALTER TABLE products RENAME COLUMN supplier_price TO supplier_price_cents;
ALTER TABLE products RENAME COLUMN price TO price_cents;

UPDATE products
SET supplier_price_cents = supplier_price_cents * 100,
    price_cents = price_cents * 100;
