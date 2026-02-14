-- Drop refresh tokens table
-- This migration rolls back the refresh tokens table creation

-- Drop trigger first
DROP TRIGGER IF EXISTS update_refresh_tokens_updated_at ON refresh_tokens;

-- Drop table
DROP TABLE IF EXISTS refresh_tokens;