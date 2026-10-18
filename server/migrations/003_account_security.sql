ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN platform_admin INTEGER NOT NULL DEFAULT 0 CHECK(platform_admin IN (0,1));
CREATE TABLE account_tokens(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('reset','verify')),token_hash TEXT NOT NULL UNIQUE,expires_at INTEGER NOT NULL,used_at TEXT,created_at TEXT NOT NULL);
CREATE TABLE security_events(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),org_id TEXT REFERENCES organizations(id),action TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX account_tokens_hash ON account_tokens(token_hash,expires_at);
