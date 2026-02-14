-- Drop password reset tokens table
-- This migration rolls back the password reset tokens table creation

-- Drop trigger first
DROP TRIGGER IF EXISTS update_password_reset_tokens_updated_at ON password_reset_tokens;

-- Drop table
DROP TABLE IF EXISTS password_reset_tokens;