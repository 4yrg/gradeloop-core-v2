-- Drop RBAC tables and related objects
-- This migration rolls back the roles and permissions system

-- Remove default roles first
DELETE FROM roles WHERE role_name IN ('admin', 'instructor', 'student');

-- Drop triggers first
DROP TRIGGER IF EXISTS update_permissions_updated_at ON permissions;
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;

-- Drop junction tables first (due to foreign key constraints)
DROP TABLE IF EXISTS roles_permissions;
DROP TABLE IF EXISTS users_roles;

-- Drop main tables
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;