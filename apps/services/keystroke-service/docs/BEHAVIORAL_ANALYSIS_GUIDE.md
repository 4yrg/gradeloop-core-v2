# Keystroke Behavioral Analysis System

## Overview

The Keystroke Behavioral Analysis System uses advanced behavioral analytics and LLM-powered insights to evaluate student coding sessions for authenticity, cognitive processes, and learning patterns. It goes beyond traditional plagiarism detection by analyzing the **journey** of code creation rather than just the final output.

## Key Features

### 1. **Developmental Logic & Iteration Analysis**
- Distinguishes between incremental construction and "all-at-once" delivery
- Identifies pivotal moments where structural changes suggest conceptual understanding shifts
- Analyzes troubleshooting style: systematic vs erratic vs confident

### 2. **Cognitive Load & Behavioral Proxies**
- Identifies "friction points" by analyzing pauses relative to technical hurdles
- Evaluates creation rhythm: confident composition vs hesitant transcription
- Interprets emotional signals through revision patterns

### 3. **Authenticity & Pattern Matching**
- Compares human signatures (natural errors, varied pacing) against synthetic signatures
- Detects copy-paste operations and AI assistance indicators
- Flags inconsistencies suggesting multiple contributors

### 4. **Pedagogical Feedback**
- Summarizes specific concepts where students struggled
- Identifies high-effort/low-output patterns requiring intervention
- Provides actionable recommendations for instructors

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Web Frontend                         │
│  • React Components (Next.js)                           │
│  • Behavioral Analysis Demo                             │
│  • Analysis Report Visualization                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              TypeScript Service Layer                   │
│  • behavioral-analysis-service.ts                       │
│  • Type definitions and API client                      │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────────────────────┐
│          API Gateway (Go) - Port 80                     │
│  Route: /api/keystroke/analyze                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│       Keystroke Service (Python FastAPI)                │
│  • behavioral_analysis.py                               │
│  • BehavioralAnalyzer class                             │
│  • Gemini API integration                               │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

```
Student Coding Session
         │
         ├─> Keystroke Events Captured
         │   (timestamp, key, dwell time, flight time)
         │
         ├─> Session Complete → Final Code
         │
         ▼
   POST /api/keystroke/analyze
         │
         ├─> Session Metrics Computation
         │   (typing speed, pauses, deletions, friction points)
         │
         ├─> Authenticity Analysis
         │   (human/synthetic signatures, anomaly detection)
         │
         ├─> Cognitive Process Analysis
         │   (incremental construction, pivotal moments, troubleshooting style)
         │
         ├─> LLM Deep Analysis (Gemini)
         │   (qualitative insights, pedagogical recommendations)
         │
         ▼
   Behavioral Analysis Report
   (metrics, scores, anomalies, feedback)
```

## API Endpoints

### Analyze Session
**POST** `/api/keystroke/analyze`

Performs comprehensive behavioral analysis on a coding session.

**Request Body:**
```json
{
  "sessionId": "session_12345",
  "studentId": "student_001",
  "events": [
    {
      "timestamp": 0,
      "key": "d",
      "keyCode": 100,
      "dwellTime": 80,
      "flightTime": 120,
      "action": "type",
      "lineNumber": 1,
      "columnNumber": 1
    }
  ],
  "finalCode": "def bubble_sort(arr):\n    ...",
  "includeReport": true
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "session_id": "session_12345",
    "student_id": "student_001",
    "timestamp": "2026-01-07T12:00:00",
    "session_metrics": {
      "total_duration": 1200,
      "total_keystrokes": 450,
      "average_typing_speed": 180,
      "deletion_rate": 0.15,
      "paste_count": 1,
      "friction_points": [...]
    },
    "authenticity_indicators": {
      "human_signature_score": 85.5,
      "synthetic_signature_score": 20.3,
      "external_assistance_probability": 0.15,
      "anomaly_flags": [...]
    },
    "cognitive_analysis": {
      "incremental_construction": true,
      "troubleshooting_style": "systematic",
      "pivotal_moments": [...],
      "struggle_areas": [...]
    },
    "process_score": {
      "overall_score": 82.5,
      "authenticity_score": 85.5,
      "active_problem_solving_score": 78.0,
      "learning_depth_score": 80.0,
      "engagement_score": 88.0,
      "confidence_level": "HIGH"
    },
    "critical_anomalies": [],
    "pedagogical_feedback": {
      "struggle_concepts": ["Array indexing around timestamp 450s"],
      "recommendations": ["Review loop boundary conditions"],
      "narrative": "Student showed systematic problem-solving..."
    }
  }
}
```

### Get Analysis Config
**GET** `/api/keystroke/analyze/config`

Returns current analysis system configuration.

**Response:**
```json
{
  "success": true,
  "config": {
    "llm_enabled": true,
    "llm_model": "gemini-2.5-flash",
    "analysis_features": [
      "Developmental Logic & Iteration",
      "Cognitive Load Analysis",
      "Authenticity Detection",
      "Pedagogical Feedback"
    ],
    "metrics_tracked": [
      "Typing speed",
      "Pause patterns",
      "Deletion rate",
      "Copy/paste detection",
      "Friction points"
    ]
  }
}
```

## Analysis Metrics

### Session Metrics
| Metric | Description | Interpretation |
|--------|-------------|----------------|
| `total_duration` | Session length in seconds | Longer sessions suggest deeper engagement |
| `total_keystrokes` | Total key presses | Higher count indicates more interaction |
| `average_typing_speed` | Characters per minute | Very high (>400 CPM) may indicate copy-paste |
| `deletion_rate` | Ratio of deletions to total keys | Natural errors: 10-25%; Too low suggests external code |
| `paste_count` | Number of paste operations | Multiple pastes are red flags |
| `long_pause_count` | Pauses >3 seconds | Indicates thinking/problem-solving moments |
| `friction_points` | Struggle areas | High deletion + long pauses = learning happening |

### Authenticity Indicators
| Indicator | Range | Good/Bad |
|-----------|-------|----------|
| `human_signature_score` | 0-100 | Higher is better (>80 = authentic) |
| `synthetic_signature_score` | 0-100 | Lower is better (<30 = authentic) |
| `external_assistance_probability` | 0-1 | Lower is better (<0.3 = likely authentic) |
| `multiple_contributor_probability` | 0-1 | Lower is better |

### Process Scores
| Score | Description | Interpretation |
|-------|-------------|----------------|
| `active_problem_solving_score` | Depth of engagement | Based on pivotal moments, friction points |
| `learning_depth_score` | Quality of learning | Systematic troubleshooting, mastery indicators |
| `authenticity_score` | Work genuineness | Human signature vs synthetic indicators |
| `engagement_score` | Student involvement | Duration, keystrokes, thinking pauses |
| `overall_score` | Combined assessment | Average of all scores |

## Anomaly Detection

### Critical Anomalies
1. **Excessive Paste Operations**
   - Threshold: >5 paste operations
   - Severity: High
   - Indicates: External code source

2. **Superhuman Speed**
   - Threshold: >400 CPM sustained
   - Severity: Critical
   - Indicates: Automated input or copy-paste

3. **Perfect Code (No Errors)**
   - Threshold: <1% deletion rate with >100 keystrokes
   - Severity: Medium
   - Indicates: Possible external code or memorization

4. **Sudden Pattern Changes**
   - Detection: Large variance between session quartiles
   - Severity: Medium
   - Indicates: Multiple contributors

## LLM Integration (Gemini)

### Setup
1. Set environment variable:
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```

2. Or configure in `.env`:
   ```
   GEMINI_API_KEY=your-api-key-here
   ```

### What LLM Analyzes
- **Qualitative patterns** in coding behavior
- **Contextual anomalies** that rules miss
- **Narrative summaries** of student journey
- **Pedagogical recommendations** tailored to observed struggles

### Fallback Behavior
If no API key is provided, the system falls back to rule-based analysis:
- Basic anomaly detection
- Statistical pattern matching
- Simple pedagogical feedback

## Installation

### Backend (Python Service)

1. **Install dependencies:**
   ```bash
   cd services/python/keystroke-service
   pip install -r requirements.txt
   ```

2. **Set up Gemini API (optional but recommended):**
   ```bash
   export GEMINI_API_KEY="your-api-key"
   ```

3. **Run the service:**
   ```bash
   python main.py
   ```

   Or with Docker:
   ```bash
   docker-compose up keystroke-service
   ```

### Frontend (Next.js)

1. **Install dependencies:**
   ```bash
   cd web
   pnpm install
   ```

2. **Configure API endpoint:**
   ```bash
   # .env.local
   NEXT_PUBLIC_KEYSTROKE_API_URL=http://localhost:8000/api/keystroke
   ```

3. **Run development server:**
   ```bash
   pnpm dev
   ```

4. **Access demo:**
   ```
   http://localhost:3000/demo/behavioral-analysis
   ```

## Usage Examples

### Example 1: Analyze Session via API

```python
import requests

# Prepare session data
session_data = {
    "sessionId": "session_001",
    "studentId": "alice",
    "events": [
        # ... keystroke events
    ],
    "finalCode": "def solution():\n    pass",
    "includeReport": True
}

# Call analysis endpoint
response = requests.post(
    "http://localhost:8000/api/keystroke/analyze",
    json=session_data
)

analysis = response.json()["analysis"]
print(f"Overall Score: {analysis['process_score']['overall_score']}")
print(f"Authenticity: {analysis['authenticity_indicators']['human_signature_score']}")
```

### Example 2: Using TypeScript Service

```typescript
import { behavioralAnalysisService } from '@/lib/behavioral-analysis-service';

// Analyze session
const analysis = await behavioralAnalysisService.analyzeSession({
  sessionId: 'session_001',
  studentId: 'alice',
  events: keystrokeEvents,
  finalCode: submittedCode,
  includeReport: true
});

// Check risk level
const risk = behavioralAnalysisService.calculateRiskLevel(analysis);
if (risk.level === 'high' || risk.level === 'critical') {
  console.warn('High risk submission detected!');
}

// Format for display
const label = behavioralAnalysisService.getAuthenticityLabel(
  analysis.authenticity_indicators
);
console.log(`Authenticity: ${label.label} ${label.emoji}`);
```

### Example 3: React Component

```tsx
import { BehavioralAnalysisReport } from '@/components/instructor/behavioral-analysis-report';

function SubmissionReview() {
  const [analysis, setAnalysis] = useState<BehavioralAnalysisResult | null>(null);
  
  const handleAnalyze = async () => {
    const result = await behavioralAnalysisService.analyzeSession({
      sessionId: submissionId,
      studentId: studentId,
      events: capturedEvents,
      finalCode: submission.code
    });
    setAnalysis(result);
  };
  
  return analysis ? (
    <BehavioralAnalysisReport analysis={analysis} />
  ) : (
    <button onClick={handleAnalyze}>Analyze Submission</button>
  );
}
```

## Interpretation Guide for Instructors

### High Authenticity (Green)
- Human Signature: >80
- Synthetic Signature: <30
- Process Score: >75
- **Action:** No concerns. Natural learning process.

### Likely Authentic (Blue)
- Human Signature: 60-80
- Synthetic Signature: 30-50
- Process Score: 50-75
- **Action:** Minor concerns. Review if combined with other red flags.

### Questionable (Yellow)
- Human Signature: 40-60
- Synthetic Signature: 50-70
- Process Score: 30-50
- **Action:** Manual review recommended. Check for specific anomalies.

### High Risk (Red)
- Human Signature: <40
- Synthetic Signature: >70
- Process Score: <30
- **Action:** Investigation required. Likely external assistance.

## Common Patterns

### Authentic Student Work
- Deletion rate: 10-25%
- Multiple friction points
- Long pauses before complex logic
- Incremental construction
- Natural typing rhythm variations
- Few or no paste operations

### Copy-Paste Behavior
- Very low deletion rate (<5%)
- Sudden blocks of perfect code
- Multiple paste operations
- Inconsistent typing speed
- No friction points
- Superhuman speed bursts

### AI-Assisted Work
- Perfect syntax on first try
- No conceptual struggles
- Consistent high-speed typing
- Lack of natural errors
- Missing "aha moments"
- Minimal revision cycles

## Best Practices

### For Instructors
1. **Don't rely on a single metric** - Use holistic view
2. **Review critical anomalies first** - Focus on high-severity flags
3. **Check pedagogical feedback** - Identify students needing help
4. **Look for patterns** - Compare across multiple submissions
5. **Use as screening tool** - Not definitive proof, but strong indicator

### For System Administrators
1. **Always use HTTPS** in production
2. **Set up Gemini API** for best results
3. **Monitor API costs** - Gemini charges per request
4. **Cache analysis results** - Avoid re-analyzing same sessions
5. **Set up Redis** for production session storage

## Troubleshooting

### Issue: "No Gemini API key"
**Solution:** Set `GEMINI_API_KEY` environment variable. System will work without it but with reduced capabilities.

### Issue: "Insufficient data for analysis"
**Solution:** Ensure at least 10 keystroke events. For reliable analysis, 100+ events recommended.

### Issue: "Analysis takes too long"
**Solution:** LLM calls can be slow. Consider:
- Using smaller context in prompts
- Caching results
- Running analysis async

### Issue: "All submissions flagged as risky"
**Solution:** Adjust thresholds in `behavioral_analysis.py`. Different populations have different typing patterns.

## Future Enhancements

- [ ] Real-time continuous analysis during coding
- [ ] Multi-session pattern analysis per student
- [ ] Baseline profile creation per student
- [ ] Integration with code similarity detection
- [ ] Support for multiple LLM providers (OpenAI, Claude)
- [ ] Advanced visualization (cognitive load heatmaps)
- [ ] Automated alerting for instructors
- [ ] Mobile app support

## Contributing

To add new analysis features:

1. **Add metric calculation** in `_compute_session_metrics()`
2. **Add authenticity check** in `_analyze_authenticity()`
3. **Add cognitive analysis** in `_analyze_cognitive_process()`
4. **Update LLM prompt** in `_llm_deep_analysis()`
5. **Update TypeScript types** in `behavioral-analysis-service.ts`
6. **Add UI component** in `behavioral-analysis-report.tsx`

## License

Part of GradeLoop Core System. See main project license.

## Support

For issues or questions:
- Check existing GitHub issues
- Review this documentation
- Contact development team

---

**Last Updated:** January 7, 2026  
**Version:** 1.0.0
