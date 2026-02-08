package usecases

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
)

// UseCaseFactory holds all use case instances
type UseCaseFactory struct {
	UserUseCase ports.UserUseCase
}

// Dependencies holds all external dependencies needed by use cases
type Dependencies struct {
	UserRepository ports.UserRepository
	Logger         Logger
}

// NewUseCaseFactory creates a new use case factory with all dependencies
func NewUseCaseFactory(deps Dependencies) *UseCaseFactory {
	return &UseCaseFactory{
		UserUseCase: NewUserUseCase(deps.UserRepository, deps.Logger),
	}
}

// Config holds configuration for use cases
type Config struct {
	PasswordResetTokenExpiry int // minutes
	MaxLoginAttempts         int
	AccountLockoutDuration   int // minutes
}

// NewUseCaseFactoryWithConfig creates a factory with configuration
func NewUseCaseFactoryWithConfig(deps Dependencies, config Config) *UseCaseFactory {
	// In the future, you can pass config to individual use cases
	// For now, we'll just use the basic factory
	return NewUseCaseFactory(deps)
}
