package lti

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/gofiber/fiber/v3"
)

type AGSClient interface {
	GetLineItems() ([]map[string]interface{}, error)
	GetScores(lineItemID string) ([]map[string]interface{}, error)
	PostScore(lineItemID string, score map[string]interface{}) error
}

type PlatformAGSClient struct {
	cfg    *config.LTIConfig
	client *http.Client
}

func NewPlatformAGSClient(cfg *config.LTIConfig) *PlatformAGSClient {
	return &PlatformAGSClient{
		cfg: cfg,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *PlatformAGSClient) GetLineItems() ([]map[string]interface{}, error) {
	url := c.cfg.PlatformURL + "/api/lti/ags/lineitems"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get line items: %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	result = map[string]interface{}{}
	result["lineItems"] = []map[string]interface{}{}
	_ = body

	return []map[string]interface{}{}, nil
}

func (c *PlatformAGSClient) GetScores(lineItemID string) ([]map[string]interface{}, error) {
	url := c.cfg.PlatformURL + "/api/lti/ags/lineitems/" + lineItemID + "/scores"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get scores: %d", resp.StatusCode)
	}

	return []map[string]interface{}{}, nil
}

func (c *PlatformAGSClient) PostScore(lineItemID string, score map[string]interface{}) error {
	url := c.cfg.PlatformURL + "/api/lti/ags/lineitems/" + lineItemID + "/scores"
	resp, err := c.client.Post(url, "application/json", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("failed to post score: %d", resp.StatusCode)
	}

	return nil
}

type AGSHandler struct {
	cfg    *config.LTIConfig
	client AGSClient
}

func NewAGSHandler(cfg *config.LTIConfig) *AGSHandler {
	h := &AGSHandler{cfg: cfg}
	if cfg.IsStrictMode() {
		h.client = NewPlatformAGSClient(cfg)
	}
	return h
}

func (h *AGSHandler) HandleListLineItems(c fiber.Ctx) error {
	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"lineItems": []fiber.Map{
				{
					"id":          "mock-lineitem-1",
					"scoreMaximum": 100.0,
					"label":      "Quiz 1",
					"resourceId": "quiz-1",
				},
				{
					"id":          "mock-lineitem-2",
					"scoreMaximum": 100.0,
					"label":      "Assignment 1",
					"resourceId": "assignment-1",
				},
			},
		})
	}

	lineItems, err := h.client.GetLineItems()
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "grade_service_unavailable",
			"reason": err.Error(),
		})
	}

	return c.JSON(fiber.Map{"lineItems": lineItems})
}

func (h *AGSHandler) HandleCreateLineItem(c fiber.Ctx) error {
	label := c.Locals("label")
	scoreMax := c.Locals("scoreMax")

	reqLabel := "Untitled"
	reqScoreMax := 100.0

	if label != nil {
		reqLabel = label.(string)
	}
	if scoreMax != nil {
		reqScoreMax = scoreMax.(float64)
	}

	if reqLabel == "" {
		reqLabel = "Untitled"
	}
	if reqScoreMax == 0 {
		reqScoreMax = 100
	}

	return c.JSON(fiber.Map{
		"id":           "new-" + time.Now().Format("20060102150405"),
		"label":        reqLabel,
		"scoreMaximum": reqScoreMax,
		"scoreMinimum": 0,
	})
}

func (h *AGSHandler) HandleScore(c fiber.Ctx) error {
	lineItemID := c.Params("lineItemId")

	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"status":  "success",
			"message": "Mock score submitted",
		})
	}

	scoreData := map[string]interface{}{
		"userId": c.Params("userId"),
		"scoreGiven": c.Locals("scoreGiven"),
		"scoreMaximum": c.Locals("scoreMaximum"),
		"activityProgress": "Completed",
		"gradingProgress": "FullyGraded",
	}

	if err := h.client.PostScore(lineItemID, scoreData); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "grade_submission_failed",
			"reason": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"status": "success",
	})
}

func (h *AGSHandler) HandleGetScores(c fiber.Ctx) error {
	lineItemID := c.Params("lineItemId")

	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"lineItem": lineItemID,
			"scores": []fiber.Map{},
		})
	}

	scores, err := h.client.GetScores(lineItemID)
	if err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":   "grade_retrieval_failed",
			"reason": err.Error(),
		})
	}

	return c.JSON(fiber.Map{"scores": scores})
}