-- Drop the trigger and function
DROP TRIGGER IF EXISTS trigger_password_reset_tokens_updated_at ON password_reset_tokens;
DROP FUNCTION IF EXISTS update_password_reset_tokens_updated_at();

-- Drop all indexes
DROP INDEX IF EXISTS idx_password_reset_tokens_active;
DROP INDEX IF EXISTS idx_password_reset_tokens_deleted_at;
DROP INDEX IF EXISTS idx_password_reset_tokens_token_hash;
DROP INDEX IF EXISTS idx_password_reset_tokens_expires_at;
DROP INDEX IF EXISTS idx_password_reset_tokens_user_id;

-- Drop the table
DROP TABLE IF EXISTS password_reset_tokens;
