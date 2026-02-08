package domain

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID                 string `gorm:"type:varchar(36);primaryKey"`
	Email              string `gorm:"uniqueIndex;not null"`
	FullName           string `gorm:"not null"`
	PasswordHash       string `gorm:"not null"`
	IsActive           bool   `gorm:"default:true"`
	IsPasswordResetReq bool   `gorm:"default:false"`
	UserType           string `gorm:"not null"` // "STUDENT" or "EMPLOYEE"
	CreatedAt          time.Time
	UpdatedAt          time.Time
	DeletedAt          gorm.DeletedAt `gorm:"index"`
	Student            *Student       `gorm:"foreignKey:UserID"`
	Employee           *Employee      `gorm:"foreignKey:UserID"`
}

type Student struct {
	UserID         string    `gorm:"type:varchar(36);primaryKey"`
	StudentRegNo   string    `gorm:"uniqueIndex;not null"`
	EnrollmentDate time.Time `gorm:"not null"`
}

type Employee struct {
	UserID      string `gorm:"type:varchar(36);primaryKey"`
	EmployeeID  string `gorm:"uniqueIndex;not null"`
	Designation string `gorm:"not null"`
}
