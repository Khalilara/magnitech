-- Rebuild users to add the supplier role while retaining existing accounts and sessions.
CREATE TABLE users_next (
  id TEXT PRIMARY KEY,
  auth_user_id TEXT UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  password_salt TEXT,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer', 'supplier')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  email_verified_at TEXT,
  last_login_at TEXT
);
INSERT INTO users_next (id, auth_user_id, email, first_name, last_name, phone, created_at, updated_at,
  password_salt, password_hash, role, is_active, email_verified_at, last_login_at)
SELECT id, auth_user_id, email, first_name, last_name, phone, created_at, updated_at,
  password_salt, password_hash, role, is_active, email_verified_at, last_login_at FROM users;

CREATE TABLE auth_sessions_next (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users_next(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO auth_sessions_next SELECT token_hash, user_id, expires_at, created_at FROM auth_sessions;

CREATE TABLE auth_identities_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users_next(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github', 'microsoft')),
  provider_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_user_id),
  UNIQUE(user_id, provider)
);
INSERT INTO auth_identities_next SELECT id, user_id, provider, provider_user_id, created_at FROM auth_identities;

DROP TABLE auth_sessions;
DROP TABLE auth_identities;
DROP TABLE users;
ALTER TABLE users_next RENAME TO users;
ALTER TABLE auth_sessions_next RENAME TO auth_sessions;
ALTER TABLE auth_identities_next RENAME TO auth_identities;
CREATE INDEX idx_users_email ON users(email COLLATE NOCASE);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);
CREATE INDEX idx_auth_identities_user ON auth_identities(user_id);

CREATE TABLE supplier_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  business_registration TEXT,
  phone TEXT NOT NULL,
  website TEXT,
  business_address TEXT NOT NULL,
  business_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decision_note TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);
CREATE INDEX idx_supplier_requests_status ON supplier_requests(status, created_at);

ALTER TABLE products ADD COLUMN supplier_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'archived'));
ALTER TABLE products ADD COLUMN rejection_reason TEXT;
ALTER TABLE products ADD COLUMN submitted_at TEXT;
UPDATE products SET submitted_at=CURRENT_TIMESTAMP WHERE submitted_at IS NULL;
ALTER TABLE products ADD COLUMN reviewed_at TEXT;
CREATE INDEX idx_products_approval_status ON products(approval_status, published, name);
CREATE INDEX idx_products_supplier ON products(supplier_id, approval_status);

CREATE TABLE admin_actions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_type TEXT NOT NULL CHECK (target_type IN ('supplier', 'product')),
  target_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'archive')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_type, target_id, created_at);
