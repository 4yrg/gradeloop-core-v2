-- Seed Initial Permissions Catalog
-- This migration populates the permissions table with the initial set of canonical permissions.
-- Naming convention: service:resource:action

INSERT INTO permissions (id, name, description, category, is_custom, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'iam:users:create', 'Create new user accounts', 'Identity & Access', false, NOW(), NOW()),
    (gen_random_uuid(), 'iam:users:read', 'View user account details', 'Identity & Access', false, NOW(), NOW()),
    (gen_random_uuid(), 'iam:users:update', 'Modify existing user accounts', 'Identity & Access', false, NOW(), NOW()),
    (gen_random_uuid(), 'iam:users:delete', 'Deactivate or delete user accounts', 'Identity & Access', false, NOW(), NOW()),
    (gen_random_uuid(), 'iam:roles:manage', 'Create, update and delete roles', 'Identity & Access', false, NOW(), NOW()),
    (gen_random_uuid(), 'academics:courses:read', 'View course information', 'Academics', false, NOW(), NOW()),
    (gen_random_uuid(), 'academics:courses:write', 'Create or modify course information', 'Academics', false, NOW(), NOW()),
    (gen_random_uuid(), 'academics:grades:read', 'View student grades', 'Academics', false, NOW(), NOW()),
    (gen_random_uuid(), 'academics:grades:write', 'Record or update student grades', 'Academics', false, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
