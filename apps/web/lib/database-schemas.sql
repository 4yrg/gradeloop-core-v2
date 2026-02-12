-- GradeLoop Session Management Database Schema
-- This file defines the database schema for secure session management
-- Compatible with PostgreSQL (used by IAM service)

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (should already exist in IAM service, included for reference)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    user_type VARCHAR(50) CHECK (user_type IN ('student', 'employee')) NOT NULL,
    password_changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    email_verification_expires_at TIMESTAMPTZ,
    password_reset_token VARCHAR(255),
    password_reset_expires_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User roles table (should already exist in IAM service)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- User role assignments (should already exist in IAM service)
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id)
);

-- Sessions table for managing user sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL DEFAULT 'Unknown Device',
    device_fingerprint VARCHAR(255), -- Browser fingerprint for additional security
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,
    last_activity TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table for secure token rotation
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- BCrypt hashed token
    token_family VARCHAR(255), -- For detecting token reuse attacks
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    revocation_reason VARCHAR(100), -- 'logout', 'security', 'expired', 'replaced'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0
);

-- JWT blacklist for revoked access tokens (before natural expiry)
CREATE TABLE jwt_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    jti VARCHAR(255) UNIQUE NOT NULL, -- JWT ID from token
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL, -- When the original token would expire
    revoked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    revoked_by UUID REFERENCES users(id),
    revocation_reason VARCHAR(100)
);

-- Security events audit log
CREATE TABLE security_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'login_attempt', 'login_success', 'logout', etc.
    event_category VARCHAR(50) DEFAULT 'authentication', -- 'authentication', 'authorization', 'session'
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    success BOOLEAN,
    failure_reason VARCHAR(255),
    metadata JSONB, -- Additional event-specific data
    risk_score INTEGER DEFAULT 0, -- 0-100 risk assessment
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting table
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL, -- IP, user ID, or combination
    resource VARCHAR(100) NOT NULL, -- 'login', 'api', 'password_reset'
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    window_duration INTERVAL DEFAULT '15 minutes',
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(identifier, resource)
);

-- Password history for preventing reuse
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trusted devices for remember me functionality
CREATE TABLE trusted_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    trust_token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    trusted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    UNIQUE(user_id, device_fingerprint)
);

-- Indexes for performance

-- User sessions indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active, expires_at);
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity);
CREATE INDEX idx_user_sessions_device_fp ON user_sessions(device_fingerprint);

-- Refresh tokens indexes
CREATE INDEX idx_refresh_tokens_session_id ON refresh_tokens(session_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_revoked ON refresh_tokens(revoked_at) WHERE revoked_at IS NOT NULL;

-- JWT blacklist indexes
CREATE INDEX idx_jwt_blacklist_jti ON jwt_blacklist(jti);
CREATE INDEX idx_jwt_blacklist_expires_at ON jwt_blacklist(expires_at);
CREATE INDEX idx_jwt_blacklist_user_id ON jwt_blacklist(user_id);

-- Security audit logs indexes
CREATE INDEX idx_security_audit_user_id ON security_audit_logs(user_id);
CREATE INDEX idx_security_audit_session_id ON security_audit_logs(session_id);
CREATE INDEX idx_security_audit_event_type ON security_audit_logs(event_type);
CREATE INDEX idx_security_audit_created_at ON security_audit_logs(created_at);
CREATE INDEX idx_security_audit_ip_address ON security_audit_logs(ip_address);
CREATE INDEX idx_security_audit_risk_score ON security_audit_logs(risk_score);

-- Rate limits indexes
CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier, resource);
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX idx_rate_limits_blocked_until ON rate_limits(blocked_until) WHERE blocked_until IS NOT NULL;

-- Password history indexes
CREATE INDEX idx_password_history_user_id ON password_history(user_id);
CREATE INDEX idx_password_history_created_at ON password_history(created_at);

-- Trusted devices indexes
CREATE INDEX idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX idx_trusted_devices_expires_at ON trusted_devices(expires_at);

-- Triggers for automatic timestamp updates

-- Update user sessions timestamp
CREATE OR REPLACE FUNCTION update_user_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_sessions_timestamp
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_sessions_timestamp();

-- Update rate limits timestamp
CREATE OR REPLACE FUNCTION update_rate_limits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rate_limits_timestamp
    BEFORE UPDATE ON rate_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_rate_limits_timestamp();

-- Cleanup functions for maintenance

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired sessions
    DELETE FROM user_sessions
    WHERE expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Log cleanup activity
    INSERT INTO security_audit_logs (event_type, event_category, metadata)
    VALUES ('session_cleanup', 'maintenance',
            jsonb_build_object('deleted_sessions', deleted_count));

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired refresh tokens
    DELETE FROM refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Log cleanup activity
    INSERT INTO security_audit_logs (event_type, event_category, metadata)
    VALUES ('token_cleanup', 'maintenance',
            jsonb_build_object('deleted_tokens', deleted_count));

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired JWT blacklist entries
CREATE OR REPLACE FUNCTION cleanup_expired_jwt_blacklist()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete expired JWT blacklist entries
    DELETE FROM jwt_blacklist
    WHERE expires_at < CURRENT_TIMESTAMP;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old audit logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete audit logs older than 90 days
    DELETE FROM security_audit_logs
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old password history (keep last 12 passwords)
CREATE OR REPLACE FUNCTION cleanup_old_password_history()
RETURNS INTEGER AS $$
DECLARE
    user_rec RECORD;
    deleted_count INTEGER := 0;
    user_deleted INTEGER;
BEGIN
    -- For each user, keep only the last 12 password entries
    FOR user_rec IN SELECT DISTINCT user_id FROM password_history LOOP
        DELETE FROM password_history
        WHERE user_id = user_rec.user_id
        AND id NOT IN (
            SELECT id FROM password_history
            WHERE user_id = user_rec.user_id
            ORDER BY created_at DESC
            LIMIT 12
        );

        GET DIAGNOSTICS user_deleted = ROW_COUNT;
        deleted_count := deleted_count + user_deleted;
    END LOOP;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Security policies and constraints

-- Ensure session expiry is reasonable (max 30 days)
ALTER TABLE user_sessions
ADD CONSTRAINT check_session_expiry
CHECK (expires_at <= created_at + INTERVAL '30 days');

-- Ensure refresh token expiry is reasonable (max 90 days)
ALTER TABLE refresh_tokens
ADD CONSTRAINT check_refresh_token_expiry
CHECK (expires_at <= created_at + INTERVAL '90 days');

-- Ensure JWT blacklist expiry is reasonable (max 1 day for access tokens)
ALTER TABLE jwt_blacklist
ADD CONSTRAINT check_jwt_blacklist_expiry
CHECK (expires_at <= revoked_at + INTERVAL '1 day');

-- Views for common queries

-- Active sessions view
CREATE OR REPLACE VIEW active_sessions AS
SELECT
    s.id,
    s.user_id,
    u.email,
    u.full_name,
    s.device_name,
    s.ip_address,
    s.last_activity,
    s.expires_at,
    s.created_at,
    EXTRACT(EPOCH FROM (s.expires_at - CURRENT_TIMESTAMP))/60 as minutes_until_expiry
FROM user_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.is_active = true
AND s.expires_at > CURRENT_TIMESTAMP;

-- Security events summary view
CREATE OR REPLACE VIEW security_events_summary AS
SELECT
    date_trunc('hour', created_at) as event_hour,
    event_type,
    event_category,
    COUNT(*) as event_count,
    COUNT(CASE WHEN success = false THEN 1 END) as failure_count,
    AVG(risk_score) as avg_risk_score,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT ip_address) as unique_ips
FROM security_audit_logs
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY date_trunc('hour', created_at), event_type, event_category
ORDER BY event_hour DESC;

-- Grant appropriate permissions (adjust based on your IAM service user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gradeloop_iam_service;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gradeloop_iam_service;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO gradeloop_iam_service;

-- Comments for documentation
COMMENT ON TABLE user_sessions IS 'Active user sessions with device tracking';
COMMENT ON TABLE refresh_tokens IS 'Secure refresh tokens with rotation support';
COMMENT ON TABLE jwt_blacklist IS 'Revoked JWT tokens before natural expiry';
COMMENT ON TABLE security_audit_logs IS 'Comprehensive security event logging';
COMMENT ON TABLE rate_limits IS 'Rate limiting counters per resource and identifier';
COMMENT ON TABLE password_history IS 'Historical passwords to prevent reuse';
COMMENT ON TABLE trusted_devices IS 'Remembered devices for enhanced UX';

COMMENT ON COLUMN refresh_tokens.token_hash IS 'BCrypt hash of the refresh token for secure storage';
COMMENT ON COLUMN refresh_tokens.token_family IS 'Family identifier for detecting token reuse attacks';
COMMENT ON COLUMN security_audit_logs.risk_score IS 'Risk assessment score (0-100) for the security event';
COMMENT ON COLUMN rate_limits.identifier IS 'IP address, user ID, or combined identifier for rate limiting';
