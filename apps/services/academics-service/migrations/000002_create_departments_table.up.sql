-- Create departments table to store academic departments within a faculty
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY,
    faculty_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_faculty FOREIGN KEY(faculty_id) REFERENCES faculties(id) ON DELETE RESTRICT, -- Prevent deleting a faculty that has departments
    CONSTRAINT uq_department_name_in_faculty UNIQUE (faculty_id, name),
    CONSTRAINT uq_department_code_in_faculty UNIQUE (faculty_id, code)
);

-- Index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_departments_deleted_at ON departments(deleted_at);

-- Index for efficient lookup of departments by faculty
CREATE INDEX IF NOT EXISTS idx_departments_faculty_id ON departments(faculty_id);
