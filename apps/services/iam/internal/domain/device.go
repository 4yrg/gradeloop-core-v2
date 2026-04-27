package domain

import (
	"time"

	"github.com/google/uuid"
)

// DeviceContext represents device information for Zero Trust
type DeviceContext struct {
	DeviceID     string `json:"device_id"`
	Fingerprint string `json:"fingerprint"`
	IPAddress   string `json:"ip_address"`
	UserAgent   string `json:"user_agent"`
	Platform    string `json:"platform"` // "windows", "macos", "linux", "ios", "android"
	Browser     string `json:"browser"`
	Trusted     bool  `json:"trusted"`
	RiskScore   float64 `json:"risk_score"` // 0.0 - 1.0

	// Metadata
	FirstSeen time.Time `json:"first_seen"`
	LastSeen  time.Time `json:"last_seen"`
}

// DeviceRegistration represents a registered device
type DeviceRegistration struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID      uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	TenantID   uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	DeviceID    string   `gorm:"size:255;uniqueIndex" json:"device_id"`
	Fingerprint string   `gorm:"size:255" json:"fingerprint"`
	IPAddress   string   `gorm:"size:50" json:"ip_address"`
	Name        string   `gorm:"size:255" json:"name"` // User-defined name
	Platform    string  `gorm:"size:50" json:"platform"`
	Trusted     bool    `gorm:"default:false" json:"trusted"`
	RiskScore   float64 `gorm:"default:0" json:"risk_score"`
	Revoked     bool    `gorm:"default:false" json:"revoked"`
	CreatedAt   time.Time `json:"created_at"`
	LastSeenAt time.Time `json:"last_seen_at"`
}

// Session represents a Zero Trust session
type Session struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID        uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	TenantID     uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	DeviceID     string   `gorm:"size:255" json:"device_id"`
	Fingerprint  string   `gorm:"size:255" json:"fingerprint"`
	IPAddress   string   `gorm:"size:50" json:"ip_address"`
	TokenID     string   `gorm:"size:255;uniqueIndex" json:"token_id"`
	IsRevoked  bool   `gorm:"default:false" json:"is_revoked"`
	ExpiresAt  time.Time `gorm:"index" json:"expires_at"`
	IssuedAt   time.Time `json:"issued_at"`
	LastValidatedAt time.Time `json:"last_validated_at"`
}

// TrustDecision represents a device trust decision
type TrustDecision struct {
	Trusted    bool    `json:"trusted"`
	Reason    string  `json:"reason"`
	RiskScore float64 `json:"risk_score"`
	MFARequired bool  `json:"mfa_required"`
}

// Device trust constants
const (
	DeviceTrustKnown = "known"
	DeviceTrustNew   = "new"
	DeviceTrustRevoked = "revoked"
)

// IsHighRisk returns true if risk score is above threshold
func (d *DeviceContext) IsHighRisk() bool {
	return d.RiskScore > 0.7
}

// IsTrustedDevice returns true if device is marked trusted
func (d *DeviceContext) IsTrustedDevice() bool {
	return d.Trusted
}

// TableName returns table name
func (DeviceRegistration) TableName() string { return "device_registrations" }
func (Session) TableName() string { return "sessions" }

// Validate checks if device context is valid
func (d *DeviceContext) Validate() bool {
	return d.DeviceID != "" && d.Fingerprint != ""
}

// NewTrustDecision creates a new trust decision
func NewTrustDecision(trusted bool, reason string, riskScore float64) *TrustDecision {
	return &TrustDecision{
		Trusted:    trusted,
		Reason:    reason,
		RiskScore: riskScore,
	}
}