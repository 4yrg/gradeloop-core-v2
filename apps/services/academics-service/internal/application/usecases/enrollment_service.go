package usecases

import (
	"context"
	"errors"
	"fmt"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/utils"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

type EnrollmentService struct {
	enrollmentRepo ports.EnrollmentRepository
	batchRepo      ports.BatchRepository
	auditRepo      ports.AuditRepository
}

func NewEnrollmentService(
	enrollmentRepo ports.EnrollmentRepository,
	batchRepo ports.BatchRepository,
	auditRepo ports.AuditRepository,
) *EnrollmentService {
	return &EnrollmentService{
		enrollmentRepo: enrollmentRepo,
		batchRepo:      batchRepo,
		auditRepo:      auditRepo,
	}
}

// Batch Membership

func (s *EnrollmentService) AddBatchMember(ctx context.Context, batchID uuid.UUID, req dto.CreateBatchMemberRequest) (*models.BatchMember, error) {
	// 1. Validate Batch exists and is active
	if _, err := s.batchRepo.GetBatchByID(ctx, batchID, false); err != nil {
		return nil, fmt.Errorf("batch not found or inactive: %w", err)
	}

	// 2. Validate User Role (Assumption: We trust IAM provided the user_id, but here we might need a call to IAM to verify role = student)
	// For now, we assume the requester has done validation or we'll add a placeholder for role check.
	// Business Rule: User must have role = student
	// TODO: Integrate with IAM service to verify user role if not already done.

	member := &models.BatchMember{
		BatchID: batchID,
		UserID:  req.UserID,
		Status:  req.Status,
	}
	if member.Status == "" {
		member.Status = models.BatchMemberStatusActive
	}

	if err := s.enrollmentRepo.AddBatchMember(ctx, member); err != nil {
		return nil, err
	}

	// Audit log
	auditLog := utils.PrepareAuditLog(ctx, "batch.member.add", "batch_member", batchID.String()+":"+req.UserID.String(), nil, member)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return member, nil
}

func (s *EnrollmentService) GetBatchMembers(ctx context.Context, batchID uuid.UUID) ([]models.BatchMember, error) {
	return s.enrollmentRepo.GetBatchMembers(ctx, batchID)
}

func (s *EnrollmentService) UpdateBatchMember(ctx context.Context, batchID, userID uuid.UUID, req dto.UpdateBatchMemberRequest) (*models.BatchMember, error) {
	member, err := s.enrollmentRepo.GetBatchMember(ctx, batchID, userID)
	if err != nil {
		return nil, err
	}

	oldState := *member
	member.Status = req.Status

	if err := s.enrollmentRepo.UpdateBatchMember(ctx, member); err != nil {
		return nil, err
	}

	// Audit log
	auditLog := utils.PrepareAuditLog(ctx, "batch.member.update", "batch_member", batchID.String()+":"+userID.String(), oldState, member)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return member, nil
}

// Course Instance

func (s *EnrollmentService) CreateCourseInstance(ctx context.Context, req dto.CreateCourseInstanceRequest) (*models.CourseInstance, error) {
	// Validate Batch exists and is active
	if _, err := s.batchRepo.GetBatchByID(ctx, req.BatchID, false); err != nil {
		return nil, fmt.Errorf("batch not found or inactive: %w", err)
	}

	instance := &models.CourseInstance{
		CourseID:   req.CourseID,
		SemesterID: req.SemesterID,
		BatchID:    req.BatchID,
		Status:     models.CourseInstanceStatusPlanned,
	}

	created, err := s.enrollmentRepo.CreateCourseInstance(ctx, instance)
	if err != nil {
		return nil, err
	}

	// Audit log
	auditLog := utils.PrepareAuditLog(ctx, "course_instance.create", "course_instance", created.ID.String(), nil, created)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return created, nil
}

func (s *EnrollmentService) GetCourseInstance(ctx context.Context, id uuid.UUID) (*models.CourseInstance, error) {
	return s.enrollmentRepo.GetCourseInstanceByID(ctx, id)
}

func (s *EnrollmentService) UpdateCourseInstance(ctx context.Context, id uuid.UUID, req dto.UpdateCourseInstanceRequest) (*models.CourseInstance, error) {
	instance, err := s.enrollmentRepo.GetCourseInstanceByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Business Rule: If Active, must have at least one Lead instructor
	if req.Status == models.CourseInstanceStatusActive {
		instructors, err := s.enrollmentRepo.GetCourseInstructors(ctx, id)
		if err != nil {
			return nil, err
		}
		hasLead := false
		for _, inst := range instructors {
			if inst.Role == models.CourseInstructorRoleLead {
				hasLead = true
				break
			}
		}
		if !hasLead {
			return nil, errors.New("cannot activate course instance without at least one Lead instructor")
		}
	}

	oldState := *instance
	instance.Status = req.Status

	updated, err := s.enrollmentRepo.UpdateCourseInstance(ctx, instance)
	if err != nil {
		return nil, err
	}

	// Audit log
	auditLog := utils.PrepareAuditLog(ctx, "course_instance.update", "course_instance", id.String(), oldState, updated)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return updated, nil
}

// Course Instructors

func (s *EnrollmentService) AssignInstructor(ctx context.Context, courseInstanceID uuid.UUID, req dto.AssignInstructorRequest) (*models.CourseInstructor, error) {
	// Validate Role = instructor
	// TODO: Role validation via IAM

	assignment := &models.CourseInstructor{
		CourseInstanceID: courseInstanceID,
		UserID:           req.UserID,
		Role:             req.Role,
	}

	if err := s.enrollmentRepo.AssignInstructor(ctx, assignment); err != nil {
		return nil, err
	}

	// Audit log
	auditLog := utils.PrepareAuditLog(ctx, "course_instructor.assign", "course_instructor", courseInstanceID.String()+":"+req.UserID.String(), nil, assignment)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return assignment, nil
}

func (s *EnrollmentService) RemoveInstructor(ctx context.Context, courseInstanceID, userID uuid.UUID) error {
	// Business Rule: Ensure we don't remove the last Lead if instance is Active
	instance, err := s.enrollmentRepo.GetCourseInstanceByID(ctx, courseInstanceID)
	if err != nil {
		return err
	}

	if instance.Status == models.CourseInstanceStatusActive {
		instructors, err := s.enrollmentRepo.GetCourseInstructors(ctx, courseInstanceID)
		if err != nil {
			return err
		}
		leadCount := 0
		isTargetLead := false
		for _, inst := range instructors {
			if inst.Role == models.CourseInstructorRoleLead {
				leadCount++
				if inst.UserID == userID {
					isTargetLead = true
				}
			}
		}
		if isTargetLead && leadCount <= 1 {
			return errors.New("cannot remove the last Lead instructor from an active course instance")
		}
	}

	if err := s.enrollmentRepo.RemoveInstructor(ctx, courseInstanceID, userID); err != nil {
		return err
	}

	// Audit log
	auditLog := utils.PrepareAuditLog(ctx, "course_instructor.remove", "course_instructor", courseInstanceID.String()+":"+userID.String(), nil, nil)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return nil
}

func (s *EnrollmentService) GetCourseInstructors(ctx context.Context, id uuid.UUID) ([]models.CourseInstructor, error) {
	return s.enrollmentRepo.GetCourseInstructors(ctx, id)
}

// Course Enrollment

func (s *EnrollmentService) EnrollStudent(ctx context.Context, courseInstanceID uuid.UUID, req dto.EnrollStudentRequest) (*models.CourseEnrollment, error) {
	// 1. Validate Course Instance exists and is NOT Cancelled
	instance, err := s.enrollmentRepo.GetCourseInstanceByID(ctx, courseInstanceID)
	if err != nil {
		return nil, err
	}
	if instance.Status == models.CourseInstanceStatusCancelled {
		return nil, errors.New("cannot enroll in a cancelled course instance")
	}

	// 2. Validate Student is member of the associated Batch
	_, err = s.enrollmentRepo.GetBatchMember(ctx, instance.BatchID, req.StudentID)
	if err != nil {
		return nil, fmt.Errorf("student must be a member of the batch %s to enroll in this course instance", instance.BatchID)
	}

	enrollment := &models.CourseEnrollment{
		CourseInstanceID: courseInstanceID,
		StudentID:        req.StudentID,
		Status:           models.EnrollmentStatusEnrolled,
	}

	if err := s.enrollmentRepo.EnrollStudent(ctx, enrollment); err != nil {
		return nil, err
	}

	// Audit log
	auditLog := utils.PrepareAuditLog(ctx, "course_enrollment.enroll", "course_enrollment", courseInstanceID.String()+":"+req.StudentID.String(), nil, enrollment)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return enrollment, nil
}

func (s *EnrollmentService) GetEnrollments(ctx context.Context, id uuid.UUID) ([]models.CourseEnrollment, error) {
	return s.enrollmentRepo.GetEnrollments(ctx, id)
}

func (s *EnrollmentService) UpdateEnrollment(ctx context.Context, courseInstanceID, studentID uuid.UUID, req dto.UpdateEnrollmentRequest) (*models.CourseEnrollment, error) {
	enrollment, err := s.enrollmentRepo.GetEnrollment(ctx, courseInstanceID, studentID)
	if err != nil {
		return nil, err
	}

	instance, err := s.enrollmentRepo.GetCourseInstanceByID(ctx, courseInstanceID)
	if err != nil {
		return nil, err
	}
	if instance.Status == models.CourseInstanceStatusCancelled {
		return nil, errors.New("cannot update enrollment for a cancelled course instance")
	}

	oldState := *enrollment
	enrollment.Status = req.Status
	enrollment.FinalGrade = req.FinalGrade

	if err := s.enrollmentRepo.UpdateEnrollment(ctx, enrollment); err != nil {
		return nil, err
	}

	// Audit log
	auditLog := utils.PrepareAuditLog(ctx, "course_enrollment.update", "course_enrollment", courseInstanceID.String()+":"+studentID.String(), oldState, enrollment)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return enrollment, nil
}
