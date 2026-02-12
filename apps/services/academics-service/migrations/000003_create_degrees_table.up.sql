-- Create ENUM type for degree level
CREATE TYPE degree_level AS ENUM ('Undergraduate', 'Postgraduate');

-- Create degrees table to store academic degrees within a department
CREATE TABLE IF NOT EXISTS degrees (
    id UUID PRIMARY KEY,
    department_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    level degree_level NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_department FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE RESTRICT, -- Prevent deleting a department that has degrees
    CONSTRAINT uq_degree_name_in_department UNIQUE (department_id, name),
    CONSTRAINT uq_degree_code_in_department UNIQUE (department_id, code)
);

-- Index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_degrees_deleted_at ON degrees(deleted_at);

-- Index for efficient lookup of degrees by department
CREATE INDEX IF NOT EXISTS idx_degrees_department_id ON degrees(department_id);

-- Index for active state filtering
CREATE INDEX IF NOT EXISTS idx_degrees_is_active ON degrees(is_active);
