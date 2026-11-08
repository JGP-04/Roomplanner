CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

DELETE FROM sessions WHERE expires_at <= now();
