package usecases_test

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
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

func (m *MockUserRepository) UpdateActivationFields(user *models.User) error {
	args := m.Called(user)
	return args.Error(0)
}

func (m *MockUserRepository) DeleteUser(id uuid.UUID) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockUserRepository) GetPermissionsByUserID(userID uuid.UUID) ([]string, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockUserRepository) GetRolesByUserID(userID uuid.UUID) ([]string, error) {
	args := m.Called(userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockUserRepository) RestoreUser(id uuid.UUID) error {
	args := m.Called(id)
	return args.Error(0)
}

// MockRoleRepository is a mock implementation of ports.RoleRepository
type MockRoleRepository struct {
	mock.Mock
}

func (m *MockRoleRepository) CreateRole(role *models.Role) error {
	args := m.Called(role)
	return args.Error(0)
}

func (m *MockRoleRepository) GetRole(id uuid.UUID) (*models.Role, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Role), args.Error(1)
}

func (m *MockRoleRepository) GetRoleByName(name string) (*models.Role, error) {
	args := m.Called(name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Role), args.Error(1)
}

func (m *MockRoleRepository) ListRoles() ([]models.Role, error) {
	args := m.Called()
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Role), args.Error(1)
}

func (m *MockRoleRepository) UpdateRolePermissions(roleID uuid.UUID, permissions []models.Permission) error {
	args := m.Called(roleID, permissions)
	return args.Error(0)
}

func (m *MockRoleRepository) DeleteRole(id uuid.UUID) error {
	args := m.Called(id)
	return args.Error(0)
}

func (m *MockRoleRepository) GetPermissionsByIDs(ids []uuid.UUID) ([]models.Permission, error) {
	args := m.Called(ids)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]models.Permission), args.Error(1)
}

// MockAuditRepository is a mock implementation of ports.AuditRepository
type MockAuditRepository struct {
	mock.Mock
}

func (m *MockAuditRepository) CreateAuditLog(ctx context.Context, log *models.AuditLog) error {
	args := m.Called(ctx, mock.Anything)
	return args.Error(0)
}
