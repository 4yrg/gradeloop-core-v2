package usecases_test

import (
	"context"
	"testing"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestEnrollmentService_AddBatchMember(t *testing.T) {
	batchID := uuid.New()
	userID := uuid.New()
	ctx := context.TODO()

	t.Run("successful enrollment", func(t *testing.T) {
		mockEnrollmentRepo := new(MockEnrollmentRepository)
		mockBatchRepo := new(MockBatchRepository)
		mockAuditRepo := new(MockAuditRepository)
		service := usecases.NewEnrollmentService(mockEnrollmentRepo, mockBatchRepo, mockAuditRepo)

		mockBatchRepo.On("GetBatchByID", ctx, batchID, false).Return(&models.Batch{ID: batchID}, nil)
		mockEnrollmentRepo.On("AddBatchMember", ctx, mock.AnythingOfType("*models.BatchMember")).Return(nil)
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil)

		req := dto.CreateBatchMemberRequest{
			UserID: userID,
			Status: models.BatchMemberStatusActive,
		}

		member, err := service.AddBatchMember(ctx, batchID, req)

		assert.NoError(t, err)
		assert.NotNil(t, member)
		assert.Equal(t, batchID, member.BatchID)
		assert.Equal(t, userID, member.UserID)
		mockBatchRepo.AssertExpectations(t)
		mockEnrollmentRepo.AssertExpectations(t)
	})

	t.Run("batch not found", func(t *testing.T) {
		mockEnrollmentRepo := new(MockEnrollmentRepository)
		mockBatchRepo := new(MockBatchRepository)
		mockAuditRepo := new(MockAuditRepository)
		service := usecases.NewEnrollmentService(mockEnrollmentRepo, mockBatchRepo, mockAuditRepo)

		mockBatchRepo.On("GetBatchByID", ctx, batchID, false).Return(nil, assert.AnError)

		req := dto.CreateBatchMemberRequest{
			UserID: userID,
			Status: models.BatchMemberStatusActive,
		}

		member, err := service.AddBatchMember(ctx, batchID, req)

		assert.Error(t, err)
		assert.Nil(t, member)
	})
}

func TestEnrollmentService_CreateCourseInstance(t *testing.T) {
	batchID := uuid.New()
	courseID := uuid.New()
	semesterID := uuid.New()
	ctx := context.TODO()

	t.Run("successful creation", func(t *testing.T) {
		mockEnrollmentRepo := new(MockEnrollmentRepository)
		mockBatchRepo := new(MockBatchRepository)
		mockAuditRepo := new(MockAuditRepository)
		service := usecases.NewEnrollmentService(mockEnrollmentRepo, mockBatchRepo, mockAuditRepo)

		mockBatchRepo.On("GetBatchByID", ctx, batchID, false).Return(&models.Batch{ID: batchID}, nil)
		createdInstance := &models.CourseInstance{
			ID:         uuid.New(),
			BatchID:    batchID,
			CourseID:   courseID,
			SemesterID: semesterID,
			Status:     models.CourseInstanceStatusPlanned,
		}
		mockEnrollmentRepo.On("CreateCourseInstance", ctx, mock.AnythingOfType("*models.CourseInstance")).Return(createdInstance, nil)
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil)

		req := dto.CreateCourseInstanceRequest{
			BatchID:    batchID,
			CourseID:   courseID,
			SemesterID: semesterID,
		}

		instance, err := service.CreateCourseInstance(ctx, req)

		assert.NoError(t, err)
		assert.NotNil(t, instance)
		assert.Equal(t, batchID, instance.BatchID)
		mockEnrollmentRepo.AssertExpectations(t)
	})
}

func TestEnrollmentService_UpdateCourseInstance_Activation(t *testing.T) {
	instanceID := uuid.New()
	ctx := context.TODO()

	t.Run("activate with lead instructor", func(t *testing.T) {
		mockEnrollmentRepo := new(MockEnrollmentRepository)
		mockBatchRepo := new(MockBatchRepository)
		mockAuditRepo := new(MockAuditRepository)
		service := usecases.NewEnrollmentService(mockEnrollmentRepo, mockBatchRepo, mockAuditRepo)

		mockEnrollmentRepo.On("GetCourseInstanceByID", ctx, instanceID).Return(&models.CourseInstance{ID: instanceID, Status: models.CourseInstanceStatusPlanned}, nil)
		mockEnrollmentRepo.On("GetCourseInstructors", ctx, instanceID).Return([]models.CourseInstructor{
			{UserID: uuid.New(), Role: models.CourseInstructorRoleLead},
		}, nil)
		mockEnrollmentRepo.On("UpdateCourseInstance", ctx, mock.Anything).Return(&models.CourseInstance{ID: instanceID, Status: models.CourseInstanceStatusActive}, nil)
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil)

		req := dto.UpdateCourseInstanceRequest{Status: models.CourseInstanceStatusActive}
		instance, err := service.UpdateCourseInstance(ctx, instanceID, req)

		assert.NoError(t, err)
		assert.Equal(t, models.CourseInstanceStatusActive, instance.Status)
	})

	t.Run("activate without lead instructor", func(t *testing.T) {
		mockEnrollmentRepo := new(MockEnrollmentRepository)
		mockBatchRepo := new(MockBatchRepository)
		mockAuditRepo := new(MockAuditRepository)
		service := usecases.NewEnrollmentService(mockEnrollmentRepo, mockBatchRepo, mockAuditRepo)

		mockEnrollmentRepo.On("GetCourseInstanceByID", ctx, instanceID).Return(&models.CourseInstance{ID: instanceID, Status: models.CourseInstanceStatusPlanned}, nil)
		mockEnrollmentRepo.On("GetCourseInstructors", ctx, instanceID).Return([]models.CourseInstructor{
			{UserID: uuid.New(), Role: models.CourseInstructorRoleTA},
		}, nil)

		req := dto.UpdateCourseInstanceRequest{Status: models.CourseInstanceStatusActive}
		instance, err := service.UpdateCourseInstance(ctx, instanceID, req)

		assert.Error(t, err)
		assert.Nil(t, instance)
		assert.Contains(t, err.Error(), "at least one Lead instructor")
	})
}

func TestEnrollmentService_EnrollStudent(t *testing.T) {
	instanceID := uuid.New()
	batchID := uuid.New()
	studentID := uuid.New()
	ctx := context.TODO()

	t.Run("successful enrollment", func(t *testing.T) {
		mockEnrollmentRepo := new(MockEnrollmentRepository)
		mockBatchRepo := new(MockBatchRepository)
		mockAuditRepo := new(MockAuditRepository)
		service := usecases.NewEnrollmentService(mockEnrollmentRepo, mockBatchRepo, mockAuditRepo)

		mockEnrollmentRepo.On("GetCourseInstanceByID", ctx, instanceID).Return(&models.CourseInstance{ID: instanceID, BatchID: batchID}, nil)
		mockEnrollmentRepo.On("GetBatchMember", ctx, batchID, studentID).Return(&models.BatchMember{UserID: studentID}, nil)
		mockEnrollmentRepo.On("EnrollStudent", ctx, mock.Anything).Return(nil)
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil)

		req := dto.EnrollStudentRequest{StudentID: studentID}
		enrollment, err := service.EnrollStudent(ctx, instanceID, req)

		assert.NoError(t, err)
		assert.NotNil(t, enrollment)
	})

	t.Run("not a batch member", func(t *testing.T) {
		mockEnrollmentRepo := new(MockEnrollmentRepository)
		mockBatchRepo := new(MockBatchRepository)
		mockAuditRepo := new(MockAuditRepository)
		service := usecases.NewEnrollmentService(mockEnrollmentRepo, mockBatchRepo, mockAuditRepo)

		mockEnrollmentRepo.On("GetCourseInstanceByID", ctx, instanceID).Return(&models.CourseInstance{ID: instanceID, BatchID: batchID}, nil)
		mockEnrollmentRepo.On("GetBatchMember", ctx, batchID, studentID).Return(nil, assert.AnError)

		req := dto.EnrollStudentRequest{StudentID: studentID}
		enrollment, err := service.EnrollStudent(ctx, instanceID, req)

		assert.Error(t, err)
		assert.Nil(t, enrollment)
		assert.Contains(t, err.Error(), "member of the batch")
	})
}
