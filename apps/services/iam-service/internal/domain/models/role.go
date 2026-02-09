package models

import (
	"regexp"
	"time"

	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	RoleAdmin      = "admin"
	RoleInstructor = "instructor"
	RoleStudent    = "student"
)

var ReservedRoles = map[string]bool{
	RoleAdmin:      true,
	RoleInstructor: true,
	RoleStudent:    true,
}

type Permission struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string         `gorm:"uniqueIndex;not null" json:"name"`
	Description string         `json:"description"`
	Category    string         `json:"category"`
	IsCustom    bool           `gorm:"default:false" json:"is_custom"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type Role struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	RoleName    string         `gorm:"uniqueIndex;not null" json:"role_name"`
	Description string         `json:"description"`
	IsCustom    bool           `gorm:"default:true" json:"is_custom"`
	Permissions []Permission   `gorm:"many2many:roles_permissions;" json:"permissions"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

func (p *Permission) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}

	// Validate name pattern: service:resource:action
	pattern := `^[a-z]+:[a-z]+:[a-z]+$`
	matched, _ := regexp.MatchString(pattern, p.Name)
	if !matched {
		return errors.New("permission name must follow the pattern service:resource:action")
	}

	return
}

func (p *Permission) BeforeUpdate(tx *gorm.DB) (err error) {
	return errors.New("permissions are immutable at runtime")
}

func (p *Permission) BeforeDelete(tx *gorm.DB) (err error) {
	return errors.New("permissions are immutable at runtime")
}

func (r *Role) BeforeCreate(tx *gorm.DB) (err error) {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}

	// Logic to protect reserved roles (E02/US02)
	if _, ok := ReservedRoles[r.RoleName]; ok {
		r.IsCustom = false
	}

	return
}

func (r *Role) BeforeUpdate(tx *gorm.DB) (err error) {
	var original Role
	if err := tx.Session(&gorm.Session{NewDB: true}).First(&original, "id = ?", r.ID).Error; err == nil {
		if !original.IsCustom && original.RoleName != r.RoleName {
			return errors.New("reserved roles cannot be renamed")
		}
	}
	return nil
}

func (r *Role) BeforeDelete(tx *gorm.DB) (err error) {
	if !r.IsCustom {
		return errors.New("reserved roles cannot be deleted")
	}
	return nil
}
