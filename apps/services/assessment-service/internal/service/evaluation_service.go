package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/client"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/dto"
	"go.uber.org/zap"
)

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

// EvaluationService handles test case evaluation for code submissions
type EvaluationService interface {
	// EvaluateSubmission executes code against test cases and returns results
	EvaluateSubmission(
		ctx context.Context,
		sourceCode string,
		languageID int,
		testCases []domain.TestCase,
	) (*EvaluationResult, error)

	// CompareOutputs compares expected and actual output with normalization
	CompareOutputs(expected, actual string) bool

	// CalculateExecutionScore computes the execution score based on test results
	CalculateExecutionScore(passed, total int, weight int) int

	// CalculateTotalScore computes the final score from criteria breakdown
	CalculateTotalScore(breakdown domain.CriteriaBreakdown) int
}

// EvaluationResult contains the aggregated test case evaluation results
type EvaluationResult struct {
	TestCasesPassed int
	TotalTestCases  int
	Results         []domain.TestCaseResult
	OverallStatus   string
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

type evaluationService struct {
	judge0Client *client.Judge0Client
	logger       *zap.Logger
}

// NewEvaluationService creates a new EvaluationService
func NewEvaluationService(judge0Client *client.Judge0Client, logger *zap.Logger) EvaluationService {
	return &evaluationService{
		judge0Client: judge0Client,
		logger:       logger,
	}
}

// EvaluateSubmission executes code against all test cases
func (s *evaluationService) EvaluateSubmission(
	ctx context.Context,
	sourceCode string,
	languageID int,
	testCases []domain.TestCase,
) (*EvaluationResult, error) {
	if len(testCases) == 0 {
		return &EvaluationResult{
			TestCasesPassed: 0,
			TotalTestCases:  0,
			Results:         []domain.TestCaseResult{},
			OverallStatus:   "no_tests",
		}, nil
	}

	results := make([]domain.TestCaseResult, 0, len(testCases))
	passedCount := 0

	for _, tc := range testCases {
		result := s.evaluateSingleTestCase(ctx, sourceCode, languageID, tc)
		results = append(results, result)

		if result.Passed {
			passedCount++
		}
	}

	overallStatus := "failed"
	if passedCount == len(testCases) {
		overallStatus = "passed"
	} else if passedCount > 0 {
		overallStatus = "partial"
	}

	return &EvaluationResult{
		TestCasesPassed: passedCount,
		TotalTestCases:  len(testCases),
		Results:         results,
		OverallStatus:   overallStatus,
	}, nil
}

// evaluateSingleTestCase executes code against a single test case
func (s *evaluationService) evaluateSingleTestCase(
	ctx context.Context,
	sourceCode string,
	languageID int,
	testCase domain.TestCase,
) domain.TestCaseResult {
	result := domain.TestCaseResult{
		TestCaseID:     testCase.ID,
		Input:          testCase.Input,
		ExpectedOutput: testCase.ExpectedOutput,
	}

	// Execute code with test case input
	execResult, err := s.judge0Client.CreateSubmission(ctx, client.Judge0SubmissionRequest{
		SourceCode: sourceCode,
		LanguageID: languageID,
		Stdin:      testCase.Input,
	})

	if err != nil {
		s.logger.Error("failed to execute test case",
			zap.String("test_case_id", testCase.ID),
			zap.Error(err),
		)
		result.StatusID = 13 // Internal Error
		result.StatusDesc = "Internal Error"
		result.ActualOutput = ""
		result.Passed = false
		return result
	}

	result.ActualOutput = execResult.Stdout
	result.ExecutionTime = execResult.Time
	result.MemoryUsed = execResult.Memory
	result.StatusID = execResult.Status.ID
	result.StatusDesc = execResult.Status.Description

	// Check if execution was successful
	if !client.IsStatusFinal(execResult.Status.ID) {
		result.Passed = false
		return result
	}

	// Compare outputs (with normalization)
	result.Passed = s.CompareOutputs(testCase.ExpectedOutput, execResult.Stdout)

	return result
}

// CompareOutputs compares expected and actual output with normalization
// Normalization includes:
// - Trimming trailing whitespace from each line
// - Trimming leading/trailing whitespace from the entire output
// - Case-sensitive comparison
func (s *evaluationService) CompareOutputs(expected, actual string) bool {
	// Normalize expected output
	normalizedExpected := normalizeOutput(expected)
	// Normalize actual output
	normalizedActual := normalizeOutput(actual)

	return normalizedExpected == normalizedActual
}

// normalizeOutput applies normalization rules to output string
func normalizeOutput(output string) string {
	// Split into lines
	lines := strings.Split(output, "\n")

	// Trim trailing whitespace from each line
	for i, line := range lines {
		lines[i] = strings.TrimRight(line, " \t\r")
	}

	// Rejoin and trim overall whitespace
	result := strings.Join(lines, "\n")
	return strings.TrimSpace(result)
}

// SerializeTestCaseResults converts test case results to JSON for storage
func SerializeTestCaseResults(results []domain.TestCaseResult) ([]byte, error) {
	return json.Marshal(results)
}

// DeserializeTestCaseResults parses JSON test case results
func DeserializeTestCaseResults(data []byte) ([]domain.TestCaseResult, error) {
	var results []domain.TestCaseResult
	if err := json.Unmarshal(data, &results); err != nil {
		return nil, err
	}
	return results, nil
}

// CalculateExecutionScore computes the execution score based on test results
// Returns a score proportional to the weight based on test pass rate
func (s *evaluationService) CalculateExecutionScore(passed, total int, weight int) int {
	if total == 0 {
		return 0
	}
	if passed >= total {
		return weight
	}
	// Proportional score: (passed/total) * weight
	return (passed * weight) / total
}

// CalculateTotalScore computes the final score from criteria breakdown
func (s *evaluationService) CalculateTotalScore(breakdown domain.CriteriaBreakdown) int {
	return breakdown.Execution +
		breakdown.LogicalCorrectness +
		breakdown.BestPractices +
		breakdown.CodeQuality +
		breakdown.ConceptualUnderstanding
}

// BuildDefaultCriteriaBreakdown creates a default criteria breakdown
// using the standard ACAFS Blueprint rubric weights
func BuildDefaultCriteriaBreakdown(executionScore int) domain.CriteriaBreakdown {
	return domain.CriteriaBreakdown{
		Execution:               executionScore,
		LogicalCorrectness:      0, // To be filled by ACAFS service
		BestPractices:           0,
		CodeQuality:             0,
		ConceptualUnderstanding: 0,
	}
}

// GetDefaultRubricConfig returns the default ACAFS Blueprint rubric configuration
func GetDefaultRubricConfig() dto.RubricConfigDTO {
	return dto.RubricConfigDTO{
		Execution: dto.ExecutionConfigDTO{
			Weight: dto.FixedExecutionWeight,
			Fixed:  true,
		},
		Dimensions: []dto.RubricDimensionDTO{
			{
				ID:          "logical_correctness",
				Name:        "Logical Correctness",
				Weight:      25,
				Description: "Algorithmic accuracy and logical flow of the solution",
			},
			{
				ID:          "best_practices",
				Name:        "Best Practices",
				Weight:      20,
				Description: "Bounds checking, initialization, error handling, and defensive programming",
			},
			{
				ID:          "code_quality",
				Name:        "Code Quality",
				Weight:      15,
				Description: "Readability, modularity, naming conventions, and code organization",
			},
			{
				ID:          "conceptual_understanding",
				Name:        "Conceptual Understanding",
				Weight:      10,
				Description: "Appropriate use of programming paradigms (recursion vs iteration, etc.)",
			},
		},
	}
}

// CriteriaBreakdownFromJSON parses a criteria breakdown from JSON bytes
func CriteriaBreakdownFromJSON(data []byte) (domain.CriteriaBreakdown, error) {
	var breakdown domain.CriteriaBreakdown
	if err := json.Unmarshal(data, &breakdown); err != nil {
		return domain.CriteriaBreakdown{}, err
	}
	return breakdown, nil
}

// CriteriaBreakdownToJSON serializes a criteria breakdown to JSON bytes
func CriteriaBreakdownToJSON(breakdown domain.CriteriaBreakdown) ([]byte, error) {
	return json.Marshal(breakdown)
}

// ValidateCriteriaBreakdown ensures the breakdown sums correctly
func ValidateCriteriaBreakdown(breakdown domain.CriteriaBreakdown, expectedTotal int) error {
	total := breakdown.Execution +
		breakdown.LogicalCorrectness +
		breakdown.BestPractices +
		breakdown.CodeQuality +
		breakdown.ConceptualUnderstanding
	if total != expectedTotal {
		return errors.New("criteria breakdown total does not match expected total")
	}
	return nil
}
