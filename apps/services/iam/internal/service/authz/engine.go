package authz

import (
	"context"
	"encoding/json"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/middleware/identity"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/repository"
	"github.com/google/uuid"
)

// Engine performs authorization decisions
type Engine struct {
	cfg        *config.AuthzConfig
	policyRepo repository.PolicyRepository
	auditRepo repository.PolicyAuditRepository
}

// NewEngine creates a new authorization engine
func NewEngine(
	cfg *config.AuthzConfig,
	policyRepo repository.PolicyRepository,
	auditRepo repository.PolicyAuditRepository,
) *Engine {
	return &Engine{
		cfg:        cfg,
		policyRepo: policyRepo,
		auditRepo: auditRepo,
	}
}

// Check performs authorization check
func (e *Engine) Check(ctx context.Context, idCtx *identity.Context, action, resourceID string, resource *domain.Resource) *domain.AuthzDecision {
	// Permissive mode - allow all in local dev
	if e.cfg.IsPermissiveMode() {
		return &domain.AuthzDecision{
			Allowed: true,
			Reason:  "permissive_mode",
		}
	}

	// Strict mode - full evaluation
	return e.evaluate(ctx, idCtx, action, resourceID, resource)
}

func (e *Engine) evaluate(ctx context.Context, idCtx *identity.Context, action, resourceID string, resource *domain.Resource) *domain.AuthzDecision {
	tenantID, err := uuid.Parse(idCtx.TenantID)
	if err != nil {
		tenantID = uuid.Nil
	}

	// Get applicable policies
	policies, err := e.policyRepo.GetByAction(ctx, action, resource.Type, tenantID)
	if err != nil || len(policies) == 0 {
		// No matching policies - default deny
		return e.deny(ctx, idCtx, action, resourceID, resource.Type, "no_matching_policy")
	}

	// Evaluate policies
	for _, policy := range policies {
		// Skip if role doesn't match
		if !policy.MatchRole(idCtx.Roles) {
			continue
		}

		// Evaluate ABAC conditions
		if e.evaluateConditions(ctx, policy, idCtx, resource) {
			// Check tenant isolation
			if e.cfg.RLSEnabled && resource != nil && resource.TenantID != uuid.Nil {
				if idCtx.TenantID != resource.TenantID.String() {
					continue // Skip, wrong tenant
				}
			}

// Policy matched
		if e.cfg.ShouldAudit() {
			e.logAudit(ctx, policy, idCtx, action, resourceID)
		}

			return &domain.AuthzDecision{
				Allowed:   policy.IsAllowed(),
				Reason:    "policy_matched",
				PolicyID: policy.ID,
			}
		}
	}

	// No matching policy - deny
	return e.deny(ctx, idCtx, action, resourceID, resource.Type, "conditions_not_met")
}

func (e *Engine) evaluateConditions(ctx context.Context, policy *domain.Policy, idCtx *identity.Context, resource *domain.Resource) bool {
	if len(policy.Conditions) == 0 {
		return true // No conditions = match all
	}

	var conditions []domain.PolicyCondition
	if err := json.Unmarshal(policy.Conditions, &conditions); err != nil {
		return false
	}

	for _, c := range conditions {
		switch c.Attribute {
		case "user.role":
			if !containsString(idCtx.Roles, c.Value.(string)) {
				return false
			}
		case "resource.owner_id":
			if resource != nil && resource.OwnerID != uuid.Nil {
				if resource.OwnerID.String() != c.Value {
					return false
				}
			}
		case "resource.created_by":
			if resource != nil && resource.CreatedBy != uuid.Nil {
				if resource.CreatedBy.String() != c.Value {
					return false
				}
			}
		case "time.before":
			if e.cfg.TimeAwareEnabled {
				deadline, ok := c.Value.(string)
				if ok {
					t, err := time.Parse(time.RFC3339, deadline)
					if err == nil && time.Now().After(t) {
						return false
					}
				}
			}
		}
	}

	return true
}

func (e *Engine) deny(ctx context.Context, idCtx *identity.Context, action, resourceID, resourceType, reason string) *domain.AuthzDecision {
	if e.cfg.ShouldAudit() {
		tenantID, _ := uuid.Parse(idCtx.TenantID)
		userID, _ := uuid.Parse(idCtx.UserID)

		audit := &domain.PolicyAudit{
			TenantID:    tenantID,
			UserID:    userID,
			Action:    action,
			ResourceID: func() uuid.UUID { id, _ := uuid.Parse(resourceID); return id }(),
			ResourceType: resourceType,
			Decision: "deny",
			Reason:   reason,
		}
		if err := e.auditRepo.Create(ctx, audit); err != nil {
			// Log error but don't fail
		}
	}

	return &domain.AuthzDecision{
		Allowed: false,
		Reason:  reason,
	}
}

func (e *Engine) logAudit(ctx context.Context, policy *domain.Policy, idCtx *identity.Context, action, resourceID string) {
	tenantID, _ := uuid.Parse(idCtx.TenantID)
	userID, _ := uuid.Parse(idCtx.UserID)
	resID, _ := uuid.Parse(resourceID)

	details, _ := json.Marshal(map[string]interface{}{
		"tenant_id": idCtx.TenantID,
		"roles":    idCtx.Roles,
	})

	audit := &domain.PolicyAudit{
		PolicyID:    policy.ID,
		TenantID:    tenantID,
		UserID:      userID,
		Action:      action,
		ResourceID:  resID,
		Decision:    policy.Effect,
		Reason:      "policy_matched",
		Details:     details,
	}

	e.auditRepo.Create(ctx, audit)
}

// LoadDefaultPolicies loads default policies into DB
func (e *Engine) LoadDefaultPolicies(ctx context.Context) error {
	policies := domain.DefaultPolicies()

	for _, policy := range policies {
		// Check if exists
		existing, err := e.policyRepo.GetByID(ctx, policy.ID)
		if err == nil && existing != nil {
			continue // Already exists
		}

		// Create
		if err := e.policyRepo.Create(ctx, &policy); err != nil {
			return err
		}
	}

	return nil
}

func containsString(slice []string, s string) bool {
	for _, item := range slice {
		if item == s {
			return true
		}
	}
	return false
}