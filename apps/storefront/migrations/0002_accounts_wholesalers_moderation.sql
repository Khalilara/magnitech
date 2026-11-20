-- Accounts and product moderation for the multi-vendor marketplace.
-- Existing catalog rows are retained and treated as already approved.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'customer', 'wholesaler')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended', 'disabled')),
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wholesaler_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  legal_name TEXT,
  contact_name TEXT,
  phone TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'rejected', 'suspended')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wholesaler_profiles_status
  ON wholesaler_profiles(status, created_at);

-- Store only a hash of a randomly generated session token, never the raw token.
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expiry
  ON user_sessions(user_id, expires_at);

ALTER TABLE products ADD COLUMN wholesaler_id TEXT
  REFERENCES wholesaler_profiles(id) ON DELETE RESTRICT;
ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived'));
ALTER TABLE products ADD COLUMN reviewed_by TEXT
  REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN reviewed_at TEXT;
ALTER TABLE products ADD COLUMN rejection_reason TEXT;

-- Preserve the current catalog while making the new moderation state explicit.
UPDATE products
SET status = CASE WHEN published = 1 THEN 'approved' ELSE 'draft' END;

CREATE INDEX IF NOT EXISTS idx_products_wholesaler_status
  ON products(wholesaler_id, status);
CREATE INDEX IF NOT EXISTS idx_products_status_published
  ON products(status, published, featured, name);
