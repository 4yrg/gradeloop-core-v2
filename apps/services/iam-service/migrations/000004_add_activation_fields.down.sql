-- Remove activation and password tracking fields from users table
DROP INDEX IF EXISTS idx_users_activation_token_id;

ALTER TABLE users
DROP COLUMN IF EXISTS password_set_at,
DROP COLUMN IF EXISTS password_changed_at,
DROP COLUMN IF EXISTS activation_token_id;
