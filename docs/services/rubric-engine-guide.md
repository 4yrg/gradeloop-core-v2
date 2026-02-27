# Rubric Engine Guide

## Overview

The Multi-Dimensional Rubric Scoring Engine is a core component of the ACAFS (Automated Code Assessment and Feedback System) that enables flexible, structured grading of student code submissions. It separates deterministic execution scores from semantic evaluation criteria, allowing for fair assessment of both functional correctness and conceptual understanding.

## Architecture

### Components

1. **Assessment Service (Go-Fiber)**
   - Rubric Management API
   - Database schema for rubric storage
   - Instructor override functionality

2. **ACAFS Service (Python)**
   - Rubric Engine for scoring calculations
   - LLM Gateway for semantic evaluation
   - Socratic Agent for hint generation
   - Feedback Generator for structured reports

### Scoring Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Code Execution | 30% (fixed) | Deterministic score based on test case results |
| Logical Correctness | 25% (default) | Algorithmic accuracy and logical flow |
| Best Practices | 20% (default) | Bounds checking, initialization, error handling |
| Code Quality | 15% (default) | Readability, modularity, naming conventions |
| Conceptual Understanding | 10% (default) | Appropriate use of programming paradigms |

## API Reference

### Rubric Management

#### Create Rubric
```http
POST /api/v1/assignments/{id}/rubric
```

Request body:
```json
{
  "execution": {
    "weight": 30,
    "fixed": true,
    "test_cases": []
  },
  "dimensions": [
    {
      "id": "logical_correctness",
      "name": "Logical Correctness",
      "weight": 25,
      "description": "Algorithmic accuracy and logical flow of the solution"
    },
    {
      "id": "best_practices",
      "name": "Best Practices",
      "weight": 20,
      "description": "Bounds checking, initialization, error handling"
    },
    {
      "id": "code_quality",
      "name": "Code Quality",
      "weight": 15,
      "description": "Readability, modularity, naming conventions"
    },
    {
      "id": "conceptual_understanding",
      "name": "Conceptual Understanding",
      "weight": 10,
      "description": "Appropriate use of programming paradigms"
    }
  ]
}
```

**Validation Rules:**
- Execution weight must be exactly 30%
- Execution must be marked as `fixed: true`
- Total weight must equal 100%
- Dimension IDs must be unique and valid

#### Get Rubric
```http
GET /api/v1/assignments/{id}/rubric
```

Returns the rubric configuration for the assignment. If no custom rubric exists, returns the default Blueprint rubric.

#### Update Rubric
```http
PATCH /api/v1/assignments/{id}/rubric
```

Request body:
```json
{
  "dimensions": [
    {
      "id": "logical_correctness",
      "name": "Logical Correctness",
      "weight": 30,
      "description": "Updated description"
    }
  ]
}
```

**Notes:**
- Creates a new rubric version
- Execution configuration cannot be modified
- Previous submissions retain their original rubric version

#### Instructor Override
```http
PATCH /api/v1/evaluations/{id}/override
```

Request body:
```json
{
  "adjusted_score": 85,
  "reason": "Student demonstrated excellent understanding"
}
```

## JSON Schema

### RubricConfig
```json
{
  "type": "object",
  "properties": {
    "execution": {
      "type": "object",
      "properties": {
        "weight": { "type": "integer", "enum": [30] },
        "fixed": { "type": "boolean", "enum": [true] },
        "test_cases": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["weight", "fixed"]
    },
    "dimensions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { 
            "type": "string",
            "enum": ["logical_correctness", "best_practices", "code_quality", "conceptual_understanding"]
          },
          "name": { "type": "string" },
          "weight": { "type": "integer", "minimum": 0, "maximum": 70 },
          "description": { "type": "string" }
        },
        "required": ["id", "name", "weight", "description"]
      }
    }
  },
  "required": ["execution", "dimensions"]
}
```

### CriteriaBreakdown
```json
{
  "type": "object",
  "properties": {
    "execution": { "type": "integer", "minimum": 0, "maximum": 30 },
    "logical_correctness": { "type": "integer", "minimum": 0, "maximum": 25 },
    "best_practices": { "type": "integer", "minimum": 0, "maximum": 20 },
    "code_quality": { "type": "integer", "minimum": 0, "maximum": 15 },
    "conceptual_understanding": { "type": "integer", "minimum": 0, "maximum": 10 }
  }
}
```

## Scoring Algorithm

### Execution Scoring (Deterministic)

```python
def calculate_execution_score(passed_tests, total_tests, weight=30):
    if total_tests == 0:
        return 0
    if passed_tests >= total_tests:
        return weight
    return (passed_tests * weight) // total_tests
```

### Semantic Scoring (LLM-driven)

1. **AST Blueprint Extraction**: Parse code structure using tree-sitter
2. **LLM Evaluation**: Send code + AST + rubric context to LLM
3. **Score Normalization**: Convert 0-100 scores to weighted scores
4. **Partial Credit**: Allow logical correctness even if execution fails

### Partial Credit Logic

When execution score is 0 (e.g., compilation failure), the student can still receive:
- Full logical_correctness score if AST shows correct algorithmic intent
- Partial scores for other semantic dimensions

This ensures students are rewarded for conceptual understanding even when implementation has syntax errors.

## LLM Prompt Structure

### System Prompt
```
You are an expert code evaluator for an automated assessment system.
Your task is to evaluate student code submissions across multiple semantic dimensions.

Evaluate the code objectively based on the rubric criteria.
Provide scores from 0-100 for each dimension.
Provide brief reasoning for each score and actionable suggestions.

Respond in JSON format only.
```

### User Prompt Template
```
Please evaluate the following {language} code submission:

## Source Code
```{language}
{code}
```

## AST Blueprint
```json
{ast_blueprint}
```

## Rubric Dimensions
- {dimension_name} (Weight: {weight}%): {description}

## Response Format
Respond ONLY with a JSON object containing scores, reasoning, and suggestions.
```

## Socratic Hint Generation

The Socratic Agent generates contextual hints based on low-scoring dimensions:

1. **Identify Weak Dimensions**: Score < 50% of maximum
2. **Prioritize**: Lowest scores get highest priority
3. **Generate Hints**:
   - Use LLM for personalized hints when available
   - Fall back to template-based hints
   - Never give direct answers

### Example Hints

**Logical Correctness:**
- "Have you considered all possible edge cases in your logic?"
- "What would happen if the input was at its minimum value?"

**Best Practices:**
- "Have you checked that all variables are properly initialized?"
- "What happens if the user provides unexpected input?"

## Feedback Report Structure

### Feed Up (Current Performance)
- Performance level (excellent/good/satisfactory/needs improvement)
- Total score and percentage
- Per-dimension breakdown with status

### Feed Back (Specific Comments)
- Strengths: Dimensions scoring >= 80%
- Improvements: Dimensions scoring < 50%
- Specific suggestions for each weak area

### Feed Forward (Next Steps)
- Prioritized learning recommendations
- Target score for improvement
- Suggested resources and actions

## Edge Cases

### Missing Rubric
If no custom rubric exists for an assignment, the system uses the default Blueprint rubric:
```json
{
  "execution": { "weight": 30, "fixed": true },
  "dimensions": [
    { "id": "logical_correctness", "weight": 25 },
    { "id": "best_practices", "weight": 20 },
    { "id": "code_quality", "weight": 15 },
    { "id": "conceptual_understanding", "weight": 10 }
  ]
}
```

### Weight Overflow
If dimension weights sum to > 100%, the API returns:
```json
{
  "error": "total weight must equal 100%, got 110%"
}
```

### LLM Unavailable
If LLM scoring fails, the system:
1. Logs the error
2. Falls back to execution-only scoring
3. Sets semantic dimensions to 0
4. Continues processing without failing

### Instructor Override
Manual score adjustments:
- Store original score in audit trail
- Record instructor identity and timestamp
- Require justification reason
- Apply to total_score field

## Database Schema

### Assignments Table
```sql
ALTER TABLE assignments
ADD COLUMN rubric_config JSONB,
ADD COLUMN rubric_version INTEGER DEFAULT 1;
```

### Submissions Table
```sql
ALTER TABLE submissions
ADD COLUMN criteria_breakdown JSONB,
ADD COLUMN rubric_version_id INTEGER,
ADD COLUMN total_score INTEGER,
ADD COLUMN instructor_override JSONB;
```

### ACAFS Evaluations Table
```sql
CREATE TABLE acafs_evaluations (
    id SERIAL PRIMARY KEY,
    submission_id UUID NOT NULL UNIQUE,
    assignment_id UUID NOT NULL,
    criteria_breakdown JSONB NOT NULL,
    total_score INTEGER NOT NULL,
    semantic_feedback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Configuration

### Environment Variables

**ACAFS Service:**
```bash
LLM_API_KEY=your_openai_api_key
LLM_MODEL=gpt-4
```

### Default Configuration

The default rubric configuration is defined in:
- `apps/services/acafs-service/app/config.py`
- `apps/services/acafs-service/app/schemas/rubric.py`

## Testing

### Unit Tests
```bash
# Go tests
cd apps/services/assessment-service
go test ./internal/service/... -v

# Python tests
cd apps/services/acafs-service
pytest tests/test_rubric_engine.py -v
```

### Integration Tests
```bash
# Run integration tests
cd apps/services/acafs-service
pytest tests/test_integration.py -v
```

## Performance Considerations

- **Rubric Retrieval**: < 100ms latency (indexed queries)
- **LLM Scoring**: Asynchronous, non-blocking
- **AST Parsing**: Timeout protection (2 seconds default)
- **Score Calculation**: Synchronous, < 10ms

## Security

- Rubric modifications require admin/super_admin role
- Instructor overrides are audited
- LLM prompts are sanitized to prevent injection
- All score changes are versioned

## Future Enhancements

1. **Peer Review Support**: Allow peer-defined rubrics
2. **Dynamic Rubric Adjustment**: AI-suggested rubric modifications
3. **Automated Rubric Generation**: AI creates rubrics from assignment descriptions
4. **Advanced Partial Credit**: Machine learning-based intent detection
