package ports

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

type EnrollmentRepository interface {
	// Batch Membership
	AddBatchMember(ctx context.Context, member *models.BatchMember) error
	GetBatchMembers(ctx context.Context, batchID uuid.UUID) ([]models.BatchMember, error)
	GetBatchMember(ctx context.Context, batchID, userID uuid.UUID) (*models.BatchMember, error)
	UpdateBatchMember(ctx context.Context, member *models.BatchMember) error

	// Course Instance
	CreateCourseInstance(ctx context.Context, instance *models.CourseInstance) (*models.CourseInstance, error)
	GetCourseInstanceByID(ctx context.Context, id uuid.UUID) (*models.CourseInstance, error)
	UpdateCourseInstance(ctx context.Context, instance *models.CourseInstance) (*models.CourseInstance, error)
	ListCourseInstances(ctx context.Context, batchID *uuid.UUID, semesterID *uuid.UUID) ([]models.CourseInstance, error)

	// Course Instructor
	AssignInstructor(ctx context.Context, assignment *models.CourseInstructor) error
	RemoveInstructor(ctx context.Context, courseInstanceID, userID uuid.UUID) error
	GetCourseInstructors(ctx context.Context, courseInstanceID uuid.UUID) ([]models.CourseInstructor, error)

	// Course Enrollment
	EnrollStudent(ctx context.Context, enrollment *models.CourseEnrollment) error
	UpdateEnrollment(ctx context.Context, enrollment *models.CourseEnrollment) error
	GetEnrollments(ctx context.Context, courseInstanceID uuid.UUID) ([]models.CourseEnrollment, error)
	GetEnrollment(ctx context.Context, courseInstanceID, studentID uuid.UUID) (*models.CourseEnrollment, error)
}
