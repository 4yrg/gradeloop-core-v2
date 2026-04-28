package sso

import (
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
)

// MockProvider provides predefined SSO identities for local development
type MockProvider struct {
	users map[string]*domain.SSOIdentity
}

// NewMockProvider creates a new mock SSO provider
func NewMockProvider() *MockProvider {
	return &MockProvider{
		users: map[string]*domain.SSOIdentity{
			"admin@dev.local": {
				Provider:   "mock",
				ProviderID: "mock-admin-001",
				Email:      "admin@dev.local",
				Name:       "Dev Admin",
				GivenName:  "Dev",
				FamilyName: "Admin",
				TenantID:   "dev-university",
				Role:       "admin",
				IssuedAt:   time.Now(),
			},
			"instructor@dev.local": {
				Provider:   "mock",
				ProviderID: "mock-instructor-001",
				Email:      "instructor@dev.local",
				Name:       "Dev Instructor",
				GivenName:  "Dev",
				FamilyName: "Instructor",
				TenantID:   "dev-university",
				Role:       "instructor",
				IssuedAt:   time.Now(),
			},
			"student@dev.local": {
				Provider:   "mock",
				ProviderID: "mock-student-001",
				Email:      "student@dev.local",
				Name:       "Dev Student",
				GivenName:  "Dev",
				FamilyName: "Student",
				TenantID:   "dev-university",
				Role:       "student",
				IssuedAt:   time.Now(),
			},
			"ta@dev.local": {
				Provider:   "mock",
				ProviderID: "mock-ta-001",
				Email:      "ta@dev.local",
				Name:       "Dev TA",
				GivenName:  "Dev",
				FamilyName: "TA",
				TenantID:   "dev-university",
				Role:       "ta",
				IssuedAt:   time.Now(),
			},
			"superadmin@dev.local": {
				Provider:   "mock",
				ProviderID: "mock-superadmin-001",
				Email:      "superadmin@dev.local",
				Name:       "Dev Super Admin",
				GivenName:  "Dev",
				FamilyName: "SuperAdmin",
				TenantID:   "dev-university",
				Role:       "super_admin",
				IssuedAt:   time.Now(),
			},
		},
	}
}

// GetUser returns a mock user by email
func (m *MockProvider) GetUser(email string) (*domain.SSOIdentity, bool) {
	identity, exists := m.users[email]
	return identity, exists
}

// ListUsers returns all available mock users
func (m *MockProvider) ListUsers() []*domain.SSOIdentity {
	users := make([]*domain.SSOIdentity, 0, len(m.users))
	for _, user := range m.users {
		users = append(users, user)
	}
	return users
}

// ValidateCredentials validates mock credentials (for local login simulation)
func (m *MockProvider) ValidateCredentials(email string) (*domain.SSOIdentity, bool) {
	identity, exists := m.users[email]
	if !exists {
		return nil, false
	}
	return identity, true
}
