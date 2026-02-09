package usecases

import (
	"testing"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockUserRepository is a mock implementation of ports.UserRepository
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) CreateUser(user *models.User, student *models.Student, employee *models.Employee) error {
	args := m.Called(user, student, employee)
	return args.Error(0)
}

func (m *MockUserRepository) GetUser(id uuid.UUID, includeDeleted bool) (*models.User, error) {
	args := m.Called(id, includeDeleted)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) GetUserByEmail(email string, includeDeleted bool) (*models.User, error) {
	args := m.Called(email, includeDeleted)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.User), args.Error(1)
}

func (m *MockUserRepository) ListUsers(page, limit int, includeDeleted bool) ([]models.User, int64, error) {
	args := m.Called(page, limit, includeDeleted)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]models.User), int64(args.Int(1)), args.Error(2)
}

func (m *MockUserRepository) UpdateUser(user *models.User, student *models.Student, employee *models.Employee) error {
	args := m.Called(user, student, employee)
	return args.Error(0)
}

func (m *MockUserRepository) DeleteUser(id uuid.UUID) error {
	args := m.Called(id)
	return args.Error(0)
}

func TestRegisterUser(t *testing.T) {
	mockRepo := new(MockUserRepository)
	uc := NewUserUsecase(mockRepo)

	t.Run("successful student registration", func(t *testing.T) {
		user := &models.User{
			Email:    "test@student.com",
			UserType: models.UserTypeStudent,
		}
		student := &models.Student{
			EnrollmentDate: time.Now().AddDate(0, 0, -1),
		}

		mockRepo.On("CreateUser", mock.Anything, student, (*models.Employee)(nil)).Return(nil).Once()

		err := uc.RegisterUser(user, student, nil, "password123")
		assert.NoError(t, err)
		assert.NotEmpty(t, user.PasswordHash)
		mockRepo.AssertExpectations(t)
	})

	t.Run("fail registration with future enrollment date", func(t *testing.T) {
		user := &models.User{
			UserType: models.UserTypeStudent,
		}
		student := &models.Student{
			EnrollmentDate: time.Now().AddDate(0, 0, 1),
		}

		err := uc.RegisterUser(user, student, nil, "password123")
		assert.Error(t, err)
		assert.Equal(t, "enrollment date cannot be in the future", err.Error())
	})
}

func TestGetUser(t *testing.T) {
	mockRepo := new(MockUserRepository)
	uc := NewUserUsecase(mockRepo)
	id := uuid.New()

	t.Run("successful fetch", func(t *testing.T) {
		expectedUser := &models.User{ID: id, Email: "test@test.com"}
		mockRepo.On("GetUser", id, false).Return(expectedUser, nil).Once()

		user, err := uc.GetUser(id, false)
		assert.NoError(t, err)
		assert.Equal(t, expectedUser, user)
		mockRepo.AssertExpectations(t)
	})
}

func TestListUsers(t *testing.T) {
	mockRepo := new(MockUserRepository)
	uc := NewUserUsecase(mockRepo)

	t.Run("pagination defaults", func(t *testing.T) {
		users := []models.User{{Email: "1@test.com"}, {Email: "2@test.com"}}
		mockRepo.On("ListUsers", 1, 10, false).Return(users, 2, nil).Once()

		result, total, err := uc.ListUsers(0, 0, false)
		assert.NoError(t, err)
		assert.Equal(t, int64(2), total)
		assert.Len(t, result, 2)
		mockRepo.AssertExpectations(t)
	})
}

func TestUpdateUser(t *testing.T) {
	mockRepo := new(MockUserRepository)
	uc := NewUserUsecase(mockRepo)
	user := &models.User{ID: uuid.New()}

	t.Run("successful update", func(t *testing.T) {
		mockRepo.On("UpdateUser", user, (*models.Student)(nil), (*models.Employee)(nil)).Return(nil).Once()
		err := uc.UpdateUser(user, nil, nil)
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})
}

func TestDeleteUser(t *testing.T) {
	mockRepo := new(MockUserRepository)
	uc := NewUserUsecase(mockRepo)
	id := uuid.New()

	t.Run("successful delete", func(t *testing.T) {
		mockRepo.On("DeleteUser", id).Return(nil).Once()
		err := uc.DeleteUser(id)
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})
}
