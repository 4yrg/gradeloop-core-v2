-- Create password reset tokens table
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Create indexes for performance
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_deleted_at ON password_reset_tokens(deleted_at);

-- Create partial index for active tokens (not used and not expired)
CREATE INDEX idx_password_reset_tokens_active ON password_reset_tokens(user_id, created_at)
WHERE is_used = FALSE AND expires_at > CURRENT_TIMESTAMP AND deleted_at IS NULL;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_password_reset_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_password_reset_tokens_updated_at
    BEFORE UPDATE ON password_reset_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_password_reset_tokens_updated_at();

-- Add comment for documentation
COMMENT ON TABLE password_reset_tokens IS 'Stores secure password reset tokens for user password recovery';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'SHA256 hash of the actual token for secure storage';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration time (typically 15-30 minutes)';
COMMENT ON COLUMN password_reset_tokens.is_used IS 'Single-use enforcement flag';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was consumed';
