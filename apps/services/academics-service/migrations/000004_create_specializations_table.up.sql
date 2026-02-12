-- Create specializations table to store optional specializations within a degree
CREATE TABLE IF NOT EXISTS specializations (
    id UUID PRIMARY KEY,
    degree_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_degree FOREIGN KEY(degree_id) REFERENCES degrees(id) ON DELETE RESTRICT, -- Prevent deleting a degree that has specializations
    CONSTRAINT uq_specialization_name_in_degree UNIQUE (degree_id, name),
    CONSTRAINT uq_specialization_code_in_degree UNIQUE (degree_id, code)
);

-- Index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_specializations_deleted_at ON specializations(deleted_at);

-- Index for efficient lookup of specializations by degree
CREATE INDEX IF NOT EXISTS idx_specializations_degree_id ON specializations(degree_id);

-- Index for active state filtering
CREATE INDEX IF NOT EXISTS idx_specializations_is_active ON specializations(is_active);
