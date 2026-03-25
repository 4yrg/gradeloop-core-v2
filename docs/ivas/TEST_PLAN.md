# IVAS Service — Test Plan

## Prerequisites

```bash
# Start IVAS containers
docker compose up ivas-service ivas-postgres redis minio -d

# Wait until healthy
docker compose ps

# Tail logs (keep in separate terminal)
docker compose logs ivas-service -f --tail 50
```

> All endpoints are at `http://localhost:8088`.
> Pipe through `| jq .` for readable JSON output.

---

## Phase 1: Service Scaffold

### 1.1 Health Check

```bash
curl -s http://localhost:8088/api/v1/ivas/health | jq .
```

Expected:

```json
{
  "status": "healthy",
  "service": "ivas-service",
  "version": "0.1.0"
}
```

### 1.2 Readiness Check

```bash
curl -s http://localhost:8088/api/v1/ivas/ready | jq .
```

Expected:

```json
{
  "status": "ready",
  "checks": {
    "postgres": "ok"
  }
}
```

### 1.3 Database Tables Created

```bash
docker exec ivas-postgres psql -U ivas_user -d ivas-db -c "\dt"
```

Expected tables:

| Table                |
|----------------------|
| assignments          |
| grading_criteria     |
| questions            |
| sessions             |
| question_instances   |
| student_responses    |
| voice_profiles       |
| voice_auth_events    |
| transcripts          |

---

## Phase 2: Assignment & Question Management

### 2.1 Create Assignment

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/assignments \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Python Basics Viva",
    "description": "Test understanding of loops and functions",
    "instructor_id": "instructor-001",
    "programming_language": "python",
    "course_id": "CS101",
    "code_context": "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)"
  }' | jq .
```

Expected: HTTP 201. Save the returned `id` as `ASSIGNMENT_ID`.

```bash
export AID="<paste assignment id here>"
```

### 2.2 List Assignments

```bash
curl -s http://localhost:8088/api/v1/ivas/assignments | jq .
```

Expected: Array containing the assignment from 2.1.

### 2.3 Filter Assignments by Instructor

```bash
curl -s "http://localhost:8088/api/v1/ivas/assignments?instructor_id=instructor-001" | jq .
```

Expected: Only assignments belonging to `instructor-001`.

### 2.4 Get Assignment Detail

```bash
curl -s http://localhost:8088/api/v1/ivas/assignments/$AID | jq .
```

Expected: Assignment object with empty `criteria: []` and `questions: []`.

### 2.5 Add Grading Criteria

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/assignments/$AID/criteria \
  -H "Content-Type: application/json" \
  -d '{
    "competency": "Recursion Understanding",
    "description": "Can explain how recursive calls work",
    "max_score": 10.0,
    "weight": 1.5,
    "difficulty": 3
  }' | jq .
```

Expected: HTTP 201 with criteria object.

### 2.6 List Criteria

```bash
curl -s http://localhost:8088/api/v1/ivas/assignments/$AID/criteria | jq .
```

Expected: Array with the criteria from 2.5.

### 2.7 Add Question

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/assignments/$AID/questions \
  -H "Content-Type: application/json" \
  -d '{
    "question_text": "Explain how your fibonacci function handles the base case",
    "competency": "Recursion Understanding",
    "difficulty": 2,
    "expected_topics": ["base case", "n <= 1", "recursion termination"]
  }' | jq .
```

Expected: HTTP 201. Status = `"draft"`. Save the returned `id` as `QUESTION_ID`.

```bash
export QID="<paste question id here>"
```

### 2.8 Approve Question

```bash
curl -s -X PUT http://localhost:8088/api/v1/ivas/assignments/questions/$QID \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}' | jq .
```

Expected: `"status": "approved"`.

### 2.9 List Questions (with filter)

```bash
curl -s "http://localhost:8088/api/v1/ivas/assignments/$AID/questions?status=approved" | jq .
```

Expected: Only approved questions.

### 2.10 Update Assignment

```bash
curl -s -X PUT http://localhost:8088/api/v1/ivas/assignments/$AID \
  -H "Content-Type: application/json" \
  -d '{"title": "Python Basics Viva — Updated"}' | jq .
```

Expected: Title updated, `updated_at` changed.

### 2.11 Get Assignment Detail (nested)

```bash
curl -s http://localhost:8088/api/v1/ivas/assignments/$AID | jq .
```

Expected: `criteria` and `questions` arrays populated.

### 2.12 Delete Criteria

```bash
# Create a throwaway criteria to delete
CID=$(curl -s -X POST http://localhost:8088/api/v1/ivas/assignments/$AID/criteria \
  -H "Content-Type: application/json" \
  -d '{"competency": "Temp"}' | jq -r .id)

curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:8088/api/v1/ivas/assignments/criteria/$CID
```

Expected: `204`.

### 2.13 Delete Question

```bash
# Create a throwaway question to delete
TQID=$(curl -s -X POST http://localhost:8088/api/v1/ivas/assignments/$AID/questions \
  -H "Content-Type: application/json" \
  -d '{"question_text": "Temp question"}' | jq -r .id)

curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:8088/api/v1/ivas/assignments/questions/$TQID
```

Expected: `204`.

### 2.14 Bulk Status Update

```bash
# Create two draft questions
Q1=$(curl -s -X POST http://localhost:8088/api/v1/ivas/assignments/$AID/questions \
  -H "Content-Type: application/json" \
  -d '{"question_text": "Bulk Q1"}' | jq -r .id)

Q2=$(curl -s -X POST http://localhost:8088/api/v1/ivas/assignments/$AID/questions \
  -H "Content-Type: application/json" \
  -d '{"question_text": "Bulk Q2"}' | jq -r .id)

curl -s -X POST "http://localhost:8088/api/v1/ivas/assignments/questions/bulk-status?new_status=approved" \
  -H "Content-Type: application/json" \
  -d "[\"$Q1\", \"$Q2\"]" | jq .
```

Expected: `{"updated": 2, "status": "approved"}`.

### 2.15 404 — Non-existent Assignment

```bash
curl -s http://localhost:8088/api/v1/ivas/assignments/00000000-0000-0000-0000-000000000000 | jq .
```

Expected: HTTP 404 — `"Assignment not found."`.

---

## Phase 3: Voice Enrollment

> Voice tests require real WAV audio files with speech.
> Resemblyzer's VAD (voice activity detection) will reject pure silence or tones.

### Prepare Test Audio

**Option A — Record from mic (macOS, requires sox):**

```bash
brew install sox
# Record 3 samples (5 seconds each, speak naturally)
rec /tmp/sample1.wav rate 16k channels 1 trim 0 5
rec /tmp/sample2.wav rate 16k channels 1 trim 0 5
rec /tmp/sample3.wav rate 16k channels 1 trim 0 5
rec /tmp/verify.wav  rate 16k channels 1 trim 0 5
```

**Option B — Generate synthetic speech-like audio (for pipeline testing):**

```bash
python3 -c "
import numpy as np
try:
    import soundfile as sf
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'soundfile'])
    import soundfile as sf

sr = 16000
duration = 5
t = np.linspace(0, duration, sr * duration)

# Mix multiple frequencies to simulate speech-like audio
audio = (0.3 * np.sin(2 * np.pi * 200 * t)
       + 0.2 * np.sin(2 * np.pi * 400 * t)
       + 0.1 * np.sin(2 * np.pi * 800 * t)
       + 0.05 * np.random.randn(len(t)))
audio = audio / np.max(np.abs(audio)) * 0.9

for i in range(1, 4):
    sf.write(f'/tmp/sample{i}.wav', audio + 0.02 * np.random.randn(len(t)), sr)
sf.write('/tmp/verify.wav', audio + 0.02 * np.random.randn(len(t)), sr)
print('Created /tmp/sample1.wav, sample2.wav, sample3.wav, verify.wav')
"
```

> **Note:** Synthetic audio may fail Resemblyzer's VAD. If you get
> `"Audio too short"` errors, use Option A with real speech.

### 3.1 Check Status — Not Enrolled

```bash
curl -s http://localhost:8088/api/v1/ivas/voice/profile/student-001 | jq .
```

Expected:

```json
{
  "student_id": "student-001",
  "enrolled": false,
  "samples_count": 0,
  "required_samples": 3,
  "is_complete": false
}
```

### 3.2 Submit Sample 1

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/voice/enroll \
  -F "student_id=student-001" \
  -F "sample_index=1" \
  -F "audio=@/tmp/sample1.wav" | jq .
```

Expected:

```json
{
  "student_id": "student-001",
  "samples_count": 1,
  "required_samples": 3,
  "is_complete": false,
  "message": "Sample 1 received. 2 more needed."
}
```

### 3.3 Submit Sample 2

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/voice/enroll \
  -F "student_id=student-001" \
  -F "sample_index=2" \
  -F "audio=@/tmp/sample2.wav" | jq .
```

Expected: `"samples_count": 2`, `"is_complete": false`.

### 3.4 Submit Sample 3 (completes enrollment)

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/voice/enroll \
  -F "student_id=student-001" \
  -F "sample_index=3" \
  -F "audio=@/tmp/sample3.wav" | jq .
```

Expected:

```json
{
  "student_id": "student-001",
  "samples_count": 3,
  "required_samples": 3,
  "is_complete": true,
  "message": "Voice enrollment complete. Voiceprint stored."
}
```

### 3.5 Check Status — Enrolled

```bash
curl -s http://localhost:8088/api/v1/ivas/voice/profile/student-001 | jq .
```

Expected: `"enrolled": true`, `"is_complete": true`.

### 3.6 Verify Voice — Same Speaker

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/voice/verify \
  -F "student_id=student-001" \
  -F "audio=@/tmp/verify.wav" | jq .
```

Expected:

```json
{
  "student_id": "student-001",
  "similarity_score": 0.85,
  "is_match": true,
  "confidence": "high",
  "threshold": 0.75
}
```

> Exact `similarity_score` varies. With real speech samples from the
> same person, expect 0.80–0.95.

### 3.7 Verify Voice — Not Enrolled

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/voice/verify \
  -F "student_id=student-999" \
  -F "audio=@/tmp/verify.wav" | jq .
```

Expected: HTTP 404 — `"No voice profile found. Student must enroll first."`.

### 3.8 Re-submit Sample (overwrite)

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/voice/enroll \
  -F "student_id=student-002" \
  -F "sample_index=1" \
  -F "audio=@/tmp/sample1.wav" | jq .

# Re-submit same index with different file
curl -s -X POST http://localhost:8088/api/v1/ivas/voice/enroll \
  -F "student_id=student-002" \
  -F "sample_index=1" \
  -F "audio=@/tmp/sample2.wav" | jq .
```

Expected: `"samples_count": 1` (replaced, not duplicated).

### 3.9 Delete Voice Profile

```bash
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:8088/api/v1/ivas/voice/profile/student-001
```

Expected: `204`.

### 3.10 Delete Non-existent Profile

```bash
curl -s http://localhost:8088/api/v1/ivas/voice/profile/student-001 | jq .
```

Expected: `"enrolled": false` (profile was deleted).

### 3.11 Too-small Audio Rejection

```bash
echo "not audio" > /tmp/tiny.wav
curl -s -X POST http://localhost:8088/api/v1/ivas/voice/enroll \
  -F "student_id=student-001" \
  -F "sample_index=1" \
  -F "audio=@/tmp/tiny.wav" | jq .
```

Expected: HTTP 400 — `"Audio file too small"`.

---

## Phase 4: Live Viva Engine

> Requires `GEMINI_API_KEY` set in `.env` with a valid Google AI API key.
> Free-tier limits: 10 requests/min, 250 requests/day.

### 4.1 Create Session

Use the `ASSIGNMENT_ID` from Phase 2 tests:

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/sessions \
  -H "Content-Type: application/json" \
  -d "{
    \"assignment_id\": \"$AID\",
    \"student_id\": \"student-001\"
  }" | jq .
```

Expected: HTTP 201, status = `"initializing"`.

```bash
export SID="<paste session id here>"
```

### 4.2 List Sessions

```bash
curl -s "http://localhost:8088/api/v1/ivas/sessions?student_id=student-001" | jq .
```

Expected: Array containing the session from 4.1.

### 4.3 Get Session Detail

```bash
curl -s http://localhost:8088/api/v1/ivas/sessions/$SID | jq .
```

Expected: Session with status `"initializing"`.

### 4.4 Session — Invalid Assignment

```bash
curl -s -X POST http://localhost:8088/api/v1/ivas/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "assignment_id": "00000000-0000-0000-0000-000000000000",
    "student_id": "student-001"
  }' | jq .
```

Expected: HTTP 404 — `"Assignment not found."`.

### 4.5 WebSocket — Invalid Session

```bash
# Install: brew install websocat
websocat ws://localhost:8088/ws/ivas/session/00000000-0000-0000-0000-000000000000
```

Expected: Error message `"Session not found."` then connection closed.

### 4.6 WebSocket — Full Viva Flow

Save this as `/tmp/test_viva.py` and run:

```python
"""End-to-end test for live viva WebSocket.

Usage:
    python3 /tmp/test_viva.py <SESSION_ID>
"""

import asyncio
import base64
import json
import sys

import numpy as np

try:
    import websockets
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets


async def test_viva(session_id: str):
    uri = f"ws://localhost:8088/ws/ivas/session/{session_id}"
    print(f"Connecting to {uri} ...")

    async with websockets.connect(uri) as ws:

        # --- Step 1: session_started ---
        msg = json.loads(await ws.recv())
        print(f"\n[STEP 1] {msg['type']}")
        assert msg["type"] == "session_started", f"Expected session_started, got {msg['type']}"
        print(f"  Session ID: {msg['session_id']}")
        print("  PASS")

        # --- Step 2: Receive AI greeting ---
        print(f"\n[STEP 2] Waiting for AI greeting ...")
        audio_chunks = 0
        text_parts = []
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=30)
            msg = json.loads(raw)

            if msg["type"] == "audio":
                audio_chunks += 1
            elif msg["type"] == "text":
                text_parts.append(msg["data"])
                print(f"  Transcript: {msg['data']}")
            elif msg["type"] == "turn_complete":
                print(f"  Received {audio_chunks} audio chunks")
                print("  PASS")
                break
            elif msg["type"] == "error":
                print(f"  ERROR: {msg['data']}")
                return

        # --- Step 3: Send student audio (3 seconds of silence as PCM) ---
        print(f"\n[STEP 3] Sending 3s of audio to Gemini ...")
        silence = np.zeros(16000 * 3, dtype=np.int16)
        b64 = base64.b64encode(silence.tobytes()).decode()
        await ws.send(json.dumps({"type": "audio", "data": b64}))
        print("  Sent. Waiting for AI response ...")

        # --- Step 4: Receive AI response ---
        print(f"\n[STEP 4] Waiting for AI response ...")
        audio_chunks = 0
        try:
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=20)
                msg = json.loads(raw)

                if msg["type"] == "audio":
                    audio_chunks += 1
                elif msg["type"] == "text":
                    print(f"  Transcript: {msg['data']}")
                elif msg["type"] == "turn_complete":
                    print(f"  Received {audio_chunks} audio chunks")
                    print("  PASS")
                    break
                elif msg["type"] == "error":
                    print(f"  ERROR: {msg['data']}")
                    return
        except asyncio.TimeoutError:
            print(f"  Timeout (received {audio_chunks} audio chunks so far)")
            print("  PARTIAL PASS — Gemini may not respond to silence")

        # --- Step 5: End viva ---
        print(f"\n[STEP 5] Sending end_viva ...")
        await ws.send(json.dumps({"type": "end_viva"}))

        try:
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=15)
                msg = json.loads(raw)
                print(f"  [{msg['type']}]", msg.get("data", "")[:100])
                if msg["type"] == "session_ended":
                    print(f"  Final status: {msg['status']}")
                    print("  PASS")
                    break
        except asyncio.TimeoutError:
            print("  Timeout waiting for session_ended")
        except websockets.exceptions.ConnectionClosed:
            print("  Connection closed by server")

    print("\n===========================")
    print("ALL STEPS COMPLETED")
    print("===========================")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 /tmp/test_viva.py <SESSION_ID>")
        sys.exit(1)

    asyncio.run(test_viva(sys.argv[1]))
```

Run:

```bash
# First create a fresh session (sessions are single-use)
SID=$(curl -s -X POST http://localhost:8088/api/v1/ivas/sessions \
  -H "Content-Type: application/json" \
  -d "{\"assignment_id\": \"$AID\", \"student_id\": \"student-001\"}" | jq -r .id)

python3 /tmp/test_viva.py $SID
```

Expected output:

```
Connecting to ws://localhost:8088/ws/ivas/session/... ...

[STEP 1] session_started
  Session ID: ...
  PASS

[STEP 2] Waiting for AI greeting ...
  Received N audio chunks
  PASS

[STEP 3] Sending 3s of audio to Gemini ...
  Sent. Waiting for AI response ...

[STEP 4] Waiting for AI response ...
  Received N audio chunks
  PASS

[STEP 5] Sending end_viva ...
  [session_ended]
  Final status: completed
  PASS

===========================
ALL STEPS COMPLETED
===========================
```

### 4.7 Verify Session State After Viva

```bash
curl -s http://localhost:8088/api/v1/ivas/sessions/$SID | jq .
```

Expected: `"status": "completed"`, `"completed_at"` is populated.

### 4.8 Ping/Pong (keepalive)

Inside a WebSocket connection (before ending viva):

```json
{"type": "ping"}
```

Expected response: `{"type": "pong"}`.

---

## Quick Smoke Test (all phases)

Run this single script to validate all phases sequentially:

```bash
#!/usr/bin/env bash
set -e
BASE="http://localhost:8088/api/v1/ivas"
PASS="\033[32mPASS\033[0m"
FAIL="\033[31mFAIL\033[0m"

echo "=== Phase 1: Scaffold ==="

STATUS=$(curl -s $BASE/health | jq -r .status)
[ "$STATUS" = "healthy" ] && echo -e "1.1 Health: $PASS" || echo -e "1.1 Health: $FAIL ($STATUS)"

STATUS=$(curl -s $BASE/ready | jq -r .status)
[ "$STATUS" = "ready" ] && echo -e "1.2 Ready:  $PASS" || echo -e "1.2 Ready:  $FAIL ($STATUS)"

echo ""
echo "=== Phase 2: Assignments ==="

AID=$(curl -s -X POST $BASE/assignments \
  -H "Content-Type: application/json" \
  -d '{"title":"Smoke Test","instructor_id":"inst-1","programming_language":"python","code_context":"def add(a,b): return a+b"}' | jq -r .id)
[ "$AID" != "null" ] && echo -e "2.1 Create assignment: $PASS" || echo -e "2.1 Create assignment: $FAIL"

COUNT=$(curl -s $BASE/assignments | jq length)
[ "$COUNT" -ge 1 ] && echo -e "2.2 List assignments:  $PASS ($COUNT)" || echo -e "2.2 List assignments:  $FAIL"

CRID=$(curl -s -X POST $BASE/assignments/$AID/criteria \
  -H "Content-Type: application/json" \
  -d '{"competency":"Logic","max_score":10}' | jq -r .id)
[ "$CRID" != "null" ] && echo -e "2.3 Add criteria:      $PASS" || echo -e "2.3 Add criteria:      $FAIL"

QID=$(curl -s -X POST $BASE/assignments/$AID/questions \
  -H "Content-Type: application/json" \
  -d '{"question_text":"What does add do?","competency":"Logic"}' | jq -r .id)
[ "$QID" != "null" ] && echo -e "2.4 Add question:      $PASS" || echo -e "2.4 Add question:      $FAIL"

QSTATUS=$(curl -s -X PUT $BASE/assignments/questions/$QID \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}' | jq -r .status)
[ "$QSTATUS" = "approved" ] && echo -e "2.5 Approve question:  $PASS" || echo -e "2.5 Approve question:  $FAIL"

DETAIL=$(curl -s $BASE/assignments/$AID | jq '.criteria | length')
[ "$DETAIL" -ge 1 ] && echo -e "2.6 Nested detail:     $PASS" || echo -e "2.6 Nested detail:     $FAIL"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" $BASE/assignments/00000000-0000-0000-0000-000000000000)
[ "$HTTP" = "404" ] && echo -e "2.7 404 handling:      $PASS" || echo -e "2.7 404 handling:      $FAIL ($HTTP)"

echo ""
echo "=== Phase 3: Voice Enrollment ==="

ENROLLED=$(curl -s $BASE/voice/profile/smoke-student | jq -r .enrolled)
[ "$ENROLLED" = "false" ] && echo -e "3.1 Not enrolled:      $PASS" || echo -e "3.1 Not enrolled:      $FAIL"

echo "    (Full voice tests require real WAV audio files — see Phase 3 section above)"

echo ""
echo "=== Phase 4: Sessions ==="

SID=$(curl -s -X POST $BASE/sessions \
  -H "Content-Type: application/json" \
  -d "{\"assignment_id\": \"$AID\", \"student_id\": \"smoke-student\"}" | jq -r .id)
[ "$SID" != "null" ] && echo -e "4.1 Create session:    $PASS" || echo -e "4.1 Create session:    $FAIL"

SSTATUS=$(curl -s $BASE/sessions/$SID | jq -r .status)
[ "$SSTATUS" = "initializing" ] && echo -e "4.2 Session status:    $PASS" || echo -e "4.2 Session status:    $FAIL ($SSTATUS)"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE/sessions \
  -H "Content-Type: application/json" \
  -d '{"assignment_id":"00000000-0000-0000-0000-000000000000","student_id":"x"}')
[ "$HTTP" = "404" ] && echo -e "4.3 Invalid assignment: $PASS" || echo -e "4.3 Invalid assignment: $FAIL ($HTTP)"

echo "    (WebSocket viva test requires GEMINI_API_KEY — run test_viva.py manually)"

echo ""
echo "=== SMOKE TEST COMPLETE ==="
```

Save as `docs/ivas/smoke_test.sh` and run:

```bash
bash docs/ivas/smoke_test.sh
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Connection refused` on port 8088 | `docker compose up ivas-service -d` and wait for health check |
| Readiness returns `postgres: not_initialized` | Check `docker compose logs ivas-postgres` — DB may still be starting |
| Voice enroll returns `"Audio too short"` | Audio needs at least 1 second of detected speech. Use real voice recordings, not synthetic tones |
| Voice enroll returns 422 `"Failed to process audio"` | Ensure file is valid WAV format (16-bit PCM). Check `docker compose logs ivas-service` for the full error |
| WebSocket returns `"Session not found"` | Create the session via `POST /sessions` first. Sessions are single-use |
| WebSocket returns `"Failed to start viva"` | Check `GEMINI_API_KEY` in `.env`. Verify key is valid at https://aistudio.google.com/apikey |
| Gemini returns no audio response | Free-tier rate limit may be hit (10 RPM). Wait 60 seconds and retry |
| `docker compose up` fails to build | Run `docker compose build ivas-service --no-cache` |
