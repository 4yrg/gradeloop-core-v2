package dto

import (
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// Batch Member DTOs
type CreateBatchMemberRequest struct {
	UserID uuid.UUID                `json:"user_id" validate:"required"`
	Status models.BatchMemberStatus `json:"status" validate:"omitempty,oneof=Active Graduated Suspended"`
}

type UpdateBatchMemberRequest struct {
	Status models.BatchMemberStatus `json:"status" validate:"required,oneof=Active Graduated Suspended"`
}

type BatchMemberResponse struct {
	BatchID    uuid.UUID                `json:"batch_id"`
	UserID     uuid.UUID                `json:"user_id"`
	EnrolledAt time.Time                `json:"enrolled_at"`
	Status     models.BatchMemberStatus `json:"status"`
}

// Course Instance DTOs
type CreateCourseInstanceRequest struct {
	CourseID   uuid.UUID `json:"course_id" validate:"required"`
	SemesterID uuid.UUID `json:"semester_id" validate:"required"`
	BatchID    uuid.UUID `json:"batch_id" validate:"required"`
}

type UpdateCourseInstanceRequest struct {
	Status models.CourseInstanceStatus `json:"status" validate:"required,oneof=Planned Active Completed Cancelled"`
}

type CourseInstanceResponse struct {
	ID         uuid.UUID                   `json:"id"`
	CourseID   uuid.UUID                   `json:"course_id"`
	SemesterID uuid.UUID                   `json:"semester_id"`
	BatchID    uuid.UUID                   `json:"batch_id"`
	Status     models.CourseInstanceStatus `json:"status"`
	CreatedAt  time.Time                   `json:"created_at"`
	UpdatedAt  time.Time                   `json:"updated_at"`
}

// Course Instructor DTOs
type AssignInstructorRequest struct {
	UserID uuid.UUID                   `json:"user_id" validate:"required"`
	Role   models.CourseInstructorRole `json:"role" validate:"required,oneof=Lead TA"`
}

type CourseInstructorResponse struct {
	CourseInstanceID uuid.UUID                   `json:"course_instance_id"`
	UserID           uuid.UUID                   `json:"user_id"`
	Role             models.CourseInstructorRole `json:"role"`
	AssignedAt       time.Time                   `json:"assigned_at"`
}

// Course Enrollment DTOs
type EnrollStudentRequest struct {
	StudentID uuid.UUID `json:"student_id" validate:"required"`
}

type UpdateEnrollmentRequest struct {
	Status     models.EnrollmentStatus `json:"status" validate:"required,oneof=Enrolled Dropped Completed"`
	FinalGrade *string                 `json:"final_grade"`
}

type CourseEnrollmentResponse struct {
	CourseInstanceID uuid.UUID               `json:"course_instance_id"`
	StudentID        uuid.UUID               `json:"student_id"`
	Status           models.EnrollmentStatus `json:"status"`
	FinalGrade       *string                 `json:"final_grade,omitempty"`
	EnrolledAt       time.Time               `json:"enrolled_at"`
}

// Course DTOs
type CreateCourseRequest struct {
	Name        string `json:"name" validate:"required"`
	Code        string `json:"code" validate:"required"`
	Description string `json:"description"`
	Credits     int    `json:"credits" validate:"min=0"`
}

type CourseResponse struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	Description string    `json:"description"`
	Credits     int       `json:"credits"`
}

// Semester DTOs
type CreateSemesterRequest struct {
	Name      string    `json:"name" validate:"required"`
	StartDate time.Time `json:"start_date" validate:"required"`
	EndDate   time.Time `json:"end_date" validate:"required,gtfield=StartDate"`
}

type SemesterResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	IsActive  bool      `json:"is_active"`
}
