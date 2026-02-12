-- ENUMs for statuses and roles
DO $$ BEGIN
    CREATE TYPE batch_member_status AS ENUM ('Active', 'Graduated', 'Suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE course_instance_status AS ENUM ('Planned', 'Active', 'Completed', 'Cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE course_instructor_role AS ENUM ('Lead', 'TA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM ('Enrolled', 'Dropped', 'Completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Semesters table
CREATE TABLE IF NOT EXISTS semesters (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT chk_semester_dates CHECK (end_date > start_date)
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Batch members (Many-to-Many: Batch <-> User)
CREATE TABLE IF NOT EXISTS batch_members (
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- IAM user reference
    enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status batch_member_status NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (batch_id, user_id)
);

-- Course instances
CREATE TABLE IF NOT EXISTS course_instances (
    id UUID PRIMARY KEY,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    semester_id UUID NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    status course_instance_status NOT NULL DEFAULT 'Planned',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_course_instance UNIQUE (course_id, semester_id, batch_id)
);

-- Course instructors (Many-to-Many: CourseInstance <-> User)
CREATE TABLE IF NOT EXISTS course_instructors (
    course_instance_id UUID NOT NULL REFERENCES course_instances(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- IAM user reference
    role course_instructor_role NOT NULL DEFAULT 'TA',
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (course_instance_id, user_id)
);

-- Course enrollments (CourseInstance <-> Student)
CREATE TABLE IF NOT EXISTS course_enrollments (
    course_instance_id UUID NOT NULL REFERENCES course_instances(id) ON DELETE CASCADE,
    student_id UUID NOT NULL, -- user_id (Student)
    status enrollment_status NOT NULL DEFAULT 'Enrolled',
    final_grade VARCHAR(10),
    enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (course_instance_id, student_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_semesters_deleted_at ON semesters(deleted_at);
CREATE INDEX IF NOT EXISTS idx_courses_deleted_at ON courses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_batch_members_user_id ON batch_members(user_id);
CREATE INDEX IF NOT EXISTS idx_course_instances_batch_id ON course_instances(batch_id);
CREATE INDEX IF NOT EXISTS idx_course_instances_deleted_at ON course_instances(deleted_at);
CREATE INDEX IF NOT EXISTS idx_course_instructors_user_id ON course_instructors(user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student_id ON course_enrollments(student_id);
