-- Drop audit logs table
-- This migration rolls back the audit logs table creation

-- Drop table
DROP TABLE IF EXISTS audit_logs;