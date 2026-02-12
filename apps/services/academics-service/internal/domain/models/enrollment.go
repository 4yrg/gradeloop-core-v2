package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BatchMemberStatus string

const (
	BatchMemberStatusActive    BatchMemberStatus = "Active"
	BatchMemberStatusGraduated BatchMemberStatus = "Graduated"
	BatchMemberStatusSuspended BatchMemberStatus = "Suspended"
)

type BatchMember struct {
	BatchID    uuid.UUID         `gorm:"type:uuid;primaryKey"`
	UserID     uuid.UUID         `gorm:"type:uuid;primaryKey"`
	EnrolledAt time.Time         `gorm:"not null;default:now()"`
	Status     BatchMemberStatus `gorm:"type:batch_member_status;not null;default:'Active'"`
	CreatedAt  time.Time         `gorm:"not null"`
	UpdatedAt  time.Time         `gorm:"not null"`

	// Relationships
	Batch *Batch `gorm:"foreignKey:BatchID"`
}

type CourseInstanceStatus string

const (
	CourseInstanceStatusPlanned   CourseInstanceStatus = "Planned"
	CourseInstanceStatusActive    CourseInstanceStatus = "Active"
	CourseInstanceStatusCompleted CourseInstanceStatus = "Completed"
	CourseInstanceStatusCancelled CourseInstanceStatus = "Cancelled"
)

type CourseInstance struct {
	ID         uuid.UUID            `gorm:"type:uuid;primaryKey"`
	CourseID   uuid.UUID            `gorm:"type:uuid;not null;index"`
	SemesterID uuid.UUID            `gorm:"type:uuid;not null;index"`
	BatchID    uuid.UUID            `gorm:"type:uuid;not null;index"`
	Status     CourseInstanceStatus `gorm:"type:course_instance_status;not null;default:'Planned'"`
	CreatedAt  time.Time            `gorm:"not null"`
	UpdatedAt  time.Time            `gorm:"not null"`
	DeletedAt  gorm.DeletedAt       `gorm:"index"`

	// Relationships
	Course   *Course   `gorm:"foreignKey:CourseID"`
	Semester *Semester `gorm:"foreignKey:SemesterID"`
	Batch    *Batch    `gorm:"foreignKey:BatchID"`
}

func (ci *CourseInstance) BeforeCreate(tx *gorm.DB) (err error) {
	if ci.ID == uuid.Nil {
		ci.ID = uuid.New()
	}
	return
}

type CourseInstructorRole string

const (
	CourseInstructorRoleLead CourseInstructorRole = "Lead"
	CourseInstructorRoleTA   CourseInstructorRole = "TA"
)

type CourseInstructor struct {
	CourseInstanceID uuid.UUID            `gorm:"type:uuid;primaryKey"`
	UserID           uuid.UUID            `gorm:"type:uuid;primaryKey"`
	Role             CourseInstructorRole `gorm:"type:course_instructor_role;not null;default:'TA'"`
	AssignedAt       time.Time            `gorm:"not null;default:now()"`
	CreatedAt        time.Time            `gorm:"not null"`
	UpdatedAt        time.Time            `gorm:"not null"`

	// Relationships
	CourseInstance *CourseInstance `gorm:"foreignKey:CourseInstanceID"`
}

type EnrollmentStatus string

const (
	EnrollmentStatusEnrolled  EnrollmentStatus = "Enrolled"
	EnrollmentStatusDropped   EnrollmentStatus = "Dropped"
	EnrollmentStatusCompleted EnrollmentStatus = "Completed"
)

type CourseEnrollment struct {
	CourseInstanceID uuid.UUID        `gorm:"type:uuid;primaryKey"`
	StudentID        uuid.UUID        `gorm:"type:uuid;primaryKey;column:student_id"`
	Status           EnrollmentStatus `gorm:"type:enrollment_status;not null;default:'Enrolled'"`
	FinalGrade       *string          `gorm:"type:varchar(10)"`
	EnrolledAt       time.Time        `gorm:"not null;default:now()"`
	CreatedAt        time.Time        `gorm:"not null"`
	UpdatedAt        time.Time        `gorm:"not null"`

	// Relationships
	CourseInstance *CourseInstance `gorm:"foreignKey:CourseInstanceID"`
}

// TableName overrides the default table name for CourseEnrollment
func (CourseEnrollment) TableName() string {
	return "course_enrollments"
}
