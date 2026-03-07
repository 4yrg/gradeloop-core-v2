# Behavioral Analysis Quick Start

Get started analyzing student coding sessions in 5 minutes.

## 🚀 Quick Setup

### 1. Get a Free Gemini API Key (Optional but Recommended)

```bash
# Visit: https://makersuite.google.com/app/apikey
# Get your free API key (no credit card required)
export GEMINI_API_KEY="your-key-here"
```

### 2. Install Python Dependencies

```bash
cd services/python/keystroke-service
pip install google-generativeai
```

### 3. Start the Service

```bash
# Option A: Direct Python
python main.py

# Option B: Docker
docker-compose up keystroke-service
```

### 4. Try the Demo

```bash
# Start web frontend
cd web
pnpm install
pnpm dev

# Open browser
open http://localhost:3000/demo/behavioral-analysis
```

## 📊 Try It Now - Sample Analysis

### Using the Web Demo

1. Click **"Load Sample Data"** button
2. Click **"Run Behavioral Analysis"**
3. View comprehensive report with:
   - Overall authenticity score
   - Cognitive process insights
   - Friction points and struggle areas
   - Pedagogical recommendations

### Using curl

```bash
curl -X POST http://localhost:8000/api/keystroke/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_001",
    "studentId": "alice",
    "events": [
      {"timestamp": 0, "key": "d", "keyCode": 100, "dwellTime": 80, "flightTime": 120, "action": "type"},
      {"timestamp": 200, "key": "e", "keyCode": 101, "dwellTime": 75, "flightTime": 115, "action": "type"},
      {"timestamp": 390, "key": "f", "keyCode": 102, "dwellTime": 82, "flightTime": 118, "action": "type"}
    ],
    "finalCode": "def solution():\n    pass",
    "includeReport": true
  }'
```

## 🎯 What You Get

### Session Metrics
```
Duration: 15m 30s
Keystrokes: 450
Typing Speed: 180 CPM
Deletion Rate: 15.2%
Friction Points: 3
```

### Authenticity Assessment
```
✅ Human Signature: 85/100
⚠️ Synthetic Signature: 20/100
📊 External Assistance: 15%
🎯 Overall: HIGHLY AUTHENTIC
```

### Cognitive Analysis
```
🔨 Construction: Incremental
🧩 Troubleshooting: Systematic
💡 Pivotal Moments: 2
📚 Mastery Indicators: 3
```

### Pedagogical Feedback
```
⚠️ Struggled with:
  • Array indexing around 8m mark
  • Loop boundary conditions

✅ Recommendations:
  • Review loop fundamentals
  • Practice with edge cases
```

## 📝 Integrate into Your Code

### TypeScript/React

```typescript
import { behavioralAnalysisService } from '@/lib/behavioral-analysis-service';

// Analyze a submission
const analysis = await behavioralAnalysisService.analyzeSession({
  sessionId: submission.id,
  studentId: student.id,
  events: capturedKeystrokes, // Array of KeystrokeSessionEvent
  finalCode: submission.code
});

// Check for red flags
const risk = behavioralAnalysisService.calculateRiskLevel(analysis);
if (risk.level === 'high') {
  alert('⚠️ This submission needs manual review');
}

// Show report
<BehavioralAnalysisReport analysis={analysis} />
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:8000/api/keystroke/analyze',
    json={
        'sessionId': 'sub_123',
        'studentId': 'student_456',
        'events': keystroke_events,
        'finalCode': code
    }
)

analysis = response.json()['analysis']
score = analysis['process_score']['overall_score']

if score < 50:
    print(f"⚠️ Low authenticity score: {score}")
```

## 🎨 Interpretation Cheat Sheet

| Score | Color | Meaning | Action |
|-------|-------|---------|--------|
| >80 | 🟢 Green | Authentic | No concerns |
| 60-80 | 🔵 Blue | Likely OK | Monitor |
| 40-60 | 🟡 Yellow | Questionable | Review |
| <40 | 🔴 Red | High Risk | Investigate |

## ⚡ Common Use Cases

### 1. Exam Proctoring
```typescript
// Analyze in real-time during exam
const analysis = await analyzeSession({
  sessionId: examSessionId,
  studentId: studentId,
  events: liveKeystrokeBuffer,
  finalCode: currentCode
});

if (analysis.critical_anomalies.length > 0) {
  notifyProctor('Suspicious activity detected');
}
```

### 2. Assignment Grading
```typescript
// Batch analyze all submissions
for (const submission of assignments) {
  const analysis = await analyzeSession({...});
  
  if (analysis.process_score.overall_score < 50) {
    flagForManualReview(submission);
  }
}
```

### 3. Learning Analytics
```typescript
// Track student progress over time
const analyses = await Promise.all(
  studentSessions.map(s => analyzeSession(s))
);

const avgProblemSolving = mean(
  analyses.map(a => a.process_score.active_problem_solving_score)
);

console.log(`Student improvement: ${avgProblemSolving}`);
```

## 🔧 Configuration

### Adjust Sensitivity

Edit `services/python/keystroke-service/behavioral_analysis.py`:

```python
# Make detection stricter
if metrics.paste_count > 3:  # was 5
    anomalies.append(...)

# Make detection more lenient
if metrics.paste_count > 10:  # was 5
    anomalies.append(...)
```

### Customize LLM Prompts

```python
# In _llm_deep_analysis()
prompt = f"""
YOUR CUSTOM PROMPT HERE
Focus on specific aspects you care about
"""
```

## 📦 Sample Data Format

### Keystroke Event
```json
{
  "timestamp": 0,
  "key": "d",
  "keyCode": 100,
  "dwellTime": 80,
  "flightTime": 120,
  "action": "type",
  "lineNumber": 1,
  "columnNumber": 1,
  "codeSnapshot": "d"
}
```

### Full Request
```json
{
  "sessionId": "session_12345",
  "studentId": "alice_2024",
  "events": [
    /* array of events above */
  ],
  "finalCode": "def bubble_sort(arr):\n    # code here",
  "includeReport": true
}
```

## 🐛 Troubleshooting

**"Module not found: google.generativeai"**
```bash
pip install google-generativeai
```

**"No API key" warning**
```bash
export GEMINI_API_KEY="your-key"
# Service works without it, but with reduced features
```

**"Insufficient data"**
- Need at least 10 keystroke events
- For reliable analysis: 100+ events recommended

**"Analysis too slow"**
- LLM calls take 2-5 seconds
- Consider caching results
- Use `includeReport: false` to skip formatting

## 🎓 Next Steps

1. ✅ Run the demo
2. ✅ Integrate into your grading workflow
3. ✅ Review the full documentation: `BEHAVIORAL_ANALYSIS_GUIDE.md`
4. ✅ Customize thresholds for your use case
5. ✅ Set up production deployment with Redis caching

## 🆘 Need Help?

- 📖 Full docs: `docs/BEHAVIORAL_ANALYSIS_GUIDE.md`
- 🐛 Issues: Check GitHub issues
- 💬 Questions: Contact dev team

---

**Ready in 5 minutes. Powerful insights forever.** 🚀
