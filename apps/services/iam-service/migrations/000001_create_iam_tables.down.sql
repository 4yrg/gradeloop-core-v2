-- Drop audit_logs table
DROP TABLE IF EXISTS audit_logs;

-- Drop refresh_tokens table
DROP TABLE IF EXISTS refresh_tokens;

-- Drop role_permissions junction table
DROP TABLE IF EXISTS role_permissions;

-- Drop roles table
DROP TABLE IF EXISTS roles;

-- Drop permissions table
DROP TABLE IF EXISTS permissions;

-- Drop employees table
DROP TABLE IF EXISTS employees;

-- Drop students table
DROP TABLE IF EXISTS students;

-- Drop users table
DROP TABLE IF EXISTS users;

-- Drop UUID extension (if not used by other parts of the database)
-- DROP EXTENSION IF NOT EXISTS "uuid-ossp";