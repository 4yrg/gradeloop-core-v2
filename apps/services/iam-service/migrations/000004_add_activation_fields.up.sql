-- Add activation and password tracking fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS activation_token_id UUID;

-- Index for activation token lookup performance
CREATE INDEX IF NOT EXISTS idx_users_activation_token_id ON users(activation_token_id);
