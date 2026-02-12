package repositories

import (
	"context"
	"fmt"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EnrollmentRepositoryImpl struct {
	db *gorm.DB
}

func NewEnrollmentRepository(db *gorm.DB) ports.EnrollmentRepository {
	return &EnrollmentRepositoryImpl{db: db}
}

func (r *EnrollmentRepositoryImpl) AddBatchMember(ctx context.Context, member *models.BatchMember) error {
	if err := r.db.WithContext(ctx).Create(member).Error; err != nil {
		return fmt.Errorf("failed to add batch member: %w", err)
	}
	return nil
}

func (r *EnrollmentRepositoryImpl) GetBatchMembers(ctx context.Context, batchID uuid.UUID) ([]models.BatchMember, error) {
	var members []models.BatchMember
	if err := r.db.WithContext(ctx).Where("batch_id = ?", batchID).Find(&members).Error; err != nil {
		return nil, fmt.Errorf("failed to get batch members: %w", err)
	}
	return members, nil
}

func (r *EnrollmentRepositoryImpl) GetBatchMember(ctx context.Context, batchID, userID uuid.UUID) (*models.BatchMember, error) {
	var member models.BatchMember
	if err := r.db.WithContext(ctx).Where("batch_id = ? AND user_id = ?", batchID, userID).First(&member).Error; err != nil {
		return nil, fmt.Errorf("failed to get batch member: %w", err)
	}
	return &member, nil
}

func (r *EnrollmentRepositoryImpl) UpdateBatchMember(ctx context.Context, member *models.BatchMember) error {
	if err := r.db.WithContext(ctx).Save(member).Error; err != nil {
		return fmt.Errorf("failed to update batch member: %w", err)
	}
	return nil
}

func (r *EnrollmentRepositoryImpl) CreateCourseInstance(ctx context.Context, instance *models.CourseInstance) (*models.CourseInstance, error) {
	if err := r.db.WithContext(ctx).Create(instance).Error; err != nil {
		return nil, fmt.Errorf("failed to create course instance: %w", err)
	}
	return r.GetCourseInstanceByID(ctx, instance.ID)
}

func (r *EnrollmentRepositoryImpl) GetCourseInstanceByID(ctx context.Context, id uuid.UUID) (*models.CourseInstance, error) {
	var instance models.CourseInstance
	if err := r.db.WithContext(ctx).
		Preload("Course").
		Preload("Semester").
		Preload("Batch").
		First(&instance, "id = ?", id).Error; err != nil {
		return nil, fmt.Errorf("failed to get course instance: %w", err)
	}
	return &instance, nil
}

func (r *EnrollmentRepositoryImpl) UpdateCourseInstance(ctx context.Context, instance *models.CourseInstance) (*models.CourseInstance, error) {
	if err := r.db.WithContext(ctx).Save(instance).Error; err != nil {
		return nil, fmt.Errorf("failed to update course instance: %w", err)
	}
	return r.GetCourseInstanceByID(ctx, instance.ID)
}

func (r *EnrollmentRepositoryImpl) ListCourseInstances(ctx context.Context, batchID *uuid.UUID, semesterID *uuid.UUID) ([]models.CourseInstance, error) {
	var instances []models.CourseInstance
	query := r.db.WithContext(ctx).Preload("Course").Preload("Semester").Preload("Batch")
	if batchID != nil {
		query = query.Where("batch_id = ?", *batchID)
	}
	if semesterID != nil {
		query = query.Where("semester_id = ?", *semesterID)
	}
	if err := query.Find(&instances).Error; err != nil {
		return nil, fmt.Errorf("failed to list course instances: %w", err)
	}
	return instances, nil
}

func (r *EnrollmentRepositoryImpl) AssignInstructor(ctx context.Context, assignment *models.CourseInstructor) error {
	if err := r.db.WithContext(ctx).Create(assignment).Error; err != nil {
		return fmt.Errorf("failed to assign instructor: %w", err)
	}
	return nil
}

func (r *EnrollmentRepositoryImpl) RemoveInstructor(ctx context.Context, courseInstanceID, userID uuid.UUID) error {
	if err := r.db.WithContext(ctx).Where("course_instance_id = ? AND user_id = ?", courseInstanceID, userID).Delete(&models.CourseInstructor{}).Error; err != nil {
		return fmt.Errorf("failed to remove instructor: %w", err)
	}
	return nil
}

func (r *EnrollmentRepositoryImpl) GetCourseInstructors(ctx context.Context, courseInstanceID uuid.UUID) ([]models.CourseInstructor, error) {
	var instructors []models.CourseInstructor
	if err := r.db.WithContext(ctx).Where("course_instance_id = ?", courseInstanceID).Find(&instructors).Error; err != nil {
		return nil, fmt.Errorf("failed to get course instructors: %w", err)
	}
	return instructors, nil
}

func (r *EnrollmentRepositoryImpl) EnrollStudent(ctx context.Context, enrollment *models.CourseEnrollment) error {
	if err := r.db.WithContext(ctx).Create(enrollment).Error; err != nil {
		return fmt.Errorf("failed to enroll student: %w", err)
	}
	return nil
}

func (r *EnrollmentRepositoryImpl) UpdateEnrollment(ctx context.Context, enrollment *models.CourseEnrollment) error {
	if err := r.db.WithContext(ctx).Save(enrollment).Error; err != nil {
		return fmt.Errorf("failed to update enrollment: %w", err)
	}
	return nil
}

func (r *EnrollmentRepositoryImpl) GetEnrollments(ctx context.Context, courseInstanceID uuid.UUID) ([]models.CourseEnrollment, error) {
	var enrollments []models.CourseEnrollment
	if err := r.db.WithContext(ctx).Where("course_instance_id = ?", courseInstanceID).Find(&enrollments).Error; err != nil {
		return nil, fmt.Errorf("failed to get enrollments: %w", err)
	}
	return enrollments, nil
}

func (r *EnrollmentRepositoryImpl) GetEnrollment(ctx context.Context, courseInstanceID, studentID uuid.UUID) (*models.CourseEnrollment, error) {
	var enrollment models.CourseEnrollment
	if err := r.db.WithContext(ctx).Where("course_instance_id = ? AND student_id = ?", courseInstanceID, studentID).First(&enrollment).Error; err != nil {
		return nil, fmt.Errorf("failed to get enrollment: %w", err)
	}
	return &enrollment, nil
}
