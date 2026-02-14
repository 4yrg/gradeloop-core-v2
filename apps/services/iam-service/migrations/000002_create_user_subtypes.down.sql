-- Drop students and employees tables
-- This migration rolls back the user subtypes tables

-- Drop triggers first
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
DROP TRIGGER IF EXISTS update_students_updated_at ON students;

-- Drop tables (cascade will handle foreign key constraints)
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS students;