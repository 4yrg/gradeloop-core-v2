-- Create batches table with self-referencing hierarchy support
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY,
    parent_id UUID,
    degree_id UUID NOT NULL,
    specialization_id UUID,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    start_year INTEGER NOT NULL,
    end_year INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    CONSTRAINT fk_parent_batch FOREIGN KEY(parent_id) REFERENCES batches(id) ON DELETE RESTRICT,
    CONSTRAINT fk_degree FOREIGN KEY(degree_id) REFERENCES degrees(id) ON DELETE RESTRICT,
    CONSTRAINT fk_specialization FOREIGN KEY(specialization_id) REFERENCES specializations(id) ON DELETE RESTRICT,
    
    -- Business rule: end_year must be greater than start_year
    CONSTRAINT chk_year_range CHECK (end_year > start_year),
    
    -- Unique constraint: code must be unique across all batches
    CONSTRAINT uq_batch_code UNIQUE (code)
);

-- Index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_batches_deleted_at ON batches(deleted_at);

-- Index for active state filtering
CREATE INDEX IF NOT EXISTS idx_batches_is_active ON batches(is_active);

-- Index for tree traversal - critical for recursive queries
CREATE INDEX IF NOT EXISTS idx_batches_parent_id ON batches(parent_id);

-- Index for efficient lookup of batches by degree
CREATE INDEX IF NOT EXISTS idx_batches_degree_id ON batches(degree_id);

-- Index for efficient lookup of batches by specialization
CREATE INDEX IF NOT EXISTS idx_batches_specialization_id ON batches(specialization_id);

-- Composite index for filtering active batches by degree
CREATE INDEX IF NOT EXISTS idx_batches_degree_active ON batches(degree_id, is_active) WHERE deleted_at IS NULL;
