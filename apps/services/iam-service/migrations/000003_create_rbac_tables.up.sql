-- Create roles and permissions tables for IAM service
-- This migration creates the RBAC (Role-Based Access Control) system tables

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_custom BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Permissions table
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50),
    is_custom BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Junction table for users-roles many-to-many relationship
CREATE TABLE users_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID,
    
    -- Primary key constraint
    PRIMARY KEY (user_id, role_id),
    
    -- Foreign key constraints
    CONSTRAINT fk_users_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_users_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_users_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Junction table for roles-permissions many-to-many relationship
CREATE TABLE roles_permissions (
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    
    -- Primary key constraint
    PRIMARY KEY (role_id, permission_id),
    
    -- Foreign key constraints
    CONSTRAINT fk_roles_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_roles_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_roles_role_name ON roles(role_name);
CREATE INDEX idx_roles_is_custom ON roles(is_custom);
CREATE INDEX idx_roles_deleted_at ON roles(deleted_at);

CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_permissions_deleted_at ON permissions(deleted_at);

CREATE INDEX idx_users_roles_user_id ON users_roles(user_id);
CREATE INDEX idx_users_roles_role_id ON users_roles(role_id);

CREATE INDEX idx_roles_permissions_role_id ON roles_permissions(role_id);
CREATE INDEX idx_roles_permissions_permission_id ON roles_permissions(permission_id);

-- Create triggers for automatic updated_at timestamps
CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at 
    BEFORE UPDATE ON permissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default roles
INSERT INTO roles (role_name, description, is_custom) VALUES
    ('admin', 'System administrator with full access', FALSE),
    ('instructor', 'Instructor role for teaching staff', FALSE),
    ('student', 'Student role for learners', FALSE);