-- Create students and employees tables for IAM service
-- This migration creates polymorphic tables for user subtypes

-- Students table (polymorphic relationship with users)
CREATE TABLE students (
    id UUID PRIMARY KEY,
    enrollment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    student_reg_no VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint to users table
    CONSTRAINT fk_students_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- Employees table (polymorphic relationship with users)
CREATE TABLE employees (
    id UUID PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    designation VARCHAR(100),
    employee_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint to users table
    CONSTRAINT fk_employees_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_students_reg_no ON students(student_reg_no);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);

-- Create triggers for automatic updated_at timestamps
CREATE TRIGGER update_students_updated_at 
    BEFORE UPDATE ON students 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at 
    BEFORE UPDATE ON employees 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();