-- Create faculties table to store top-level academic divisions
CREATE TABLE IF NOT EXISTS faculties (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_faculties_deleted_at ON faculties(deleted_at);

-- Create faculty_leadership table for M2M relationship between faculties and users
CREATE TABLE IF NOT EXISTS faculty_leadership (
    faculty_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_faculty_leadership PRIMARY KEY (faculty_id, user_id),
    CONSTRAINT fk_faculty FOREIGN KEY(faculty_id) REFERENCES faculties(id) ON DELETE CASCADE
    -- Note: We cannot add a direct FK to users.id as it's in a different database.
    -- This relationship will be maintained at the application level.
);

-- Index for efficient lookup of leaders for a faculty
CREATE INDEX IF NOT EXISTS idx_faculty_leadership_faculty_id ON faculty_leadership(faculty_id);
