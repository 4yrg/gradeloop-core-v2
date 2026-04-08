# IVAS Service — High-Level Build Plan

## Context
IVAS (Intelligent Viva Assessment System) — a voice-only AI viva examiner that interviews students about their code submissions using **Gemini Live API**. Replaces the old external version (`ivas.sudila.com`) with a proper microservice. Fresh API + frontend redesign.

---

## Architecture

```
Browser (mic/speaker)
    ↕ WebSocket (raw audio frames)
IVAS Service (FastAPI, port 8088)
    ├── Gemini Live API (server-to-server, real-time voice)
    ├── Resemblyzer (local CPU, speaker verification)
    ├── PostgreSQL (dedicated ivas-postgres, port 5434)
    ├── Redis (session state)
    └── MinIO (audio storage)
```

- Backend is the **sole Gemini client** — browser never talks to Gemini
- Audio pipeline: Browser → IVAS → Gemini → IVAS → Browser
- Voice auth runs async, never blocks the viva

---

## Core Modules

### 1. Live Viva Engine (WebSocket)
- `/ws/ivas/session/{session_id}` — full viva lifecycle over WebSocket
- Receives student audio chunks, forwards to Gemini Live API
- Streams AI voice response back to browser in real-time
- Adaptive questioning: follow-up on weak answers, harder on strong, re-ask on unclear
- Session states: `initializing → in_progress → paused → completed → abandoned`
- System prompt carries assignment code + rubric + programming vocabulary

### 2. Voice Profile (Enrollment + Verification)
- **Enrollment**: Student records 3-5 samples (~10s each), reading prompted passages with programming terms
- **Model**: Resemblyzer (~50MB, CPU) extracts speaker embedding
- **Per-answer check**: Each answer's audio compared via cosine similarity to stored voiceprint
- Mismatch = flag (viva continues), anomaly shown in instructor review
- Tables: `voice_profiles`, `voice_auth_events`

### 3. Technical Term Accuracy (3-layer fix)
- **Prompt vocabulary**: Programming terms list injected into Gemini system prompt (language-specific)
- **Code grounding**: Student's actual code in prompt — Gemini disambiguates from context
- **Post-hoc correction**: Domain substitution map on transcripts before storage (e.g., "followup" → "for loop" when code has for loops)

### 4. Transcript & Audio Storage
- Full conversation transcribed and stored per session
- Audio recordings saved to MinIO (`ivas-audio` bucket)
- Per-turn: student audio + AI audio + transcript text + timestamps

### 5. White-Box Grading
- **Per-question**: score (0-10) + justification + evidence quotes + misconceptions detected
- **Per-competency**: aggregated scores mapped to rubric areas
- **Final report**: overall breakdown, strengths/weaknesses, voice auth summary
- Gemini returns structured JSON evaluation alongside voice response
- Nothing is black-box — every score has a written reason

### 6. Assignment & Question Management (REST)
- CRUD: assignments, grading criteria, question banks
- AI question generation from code context (Gemini, non-Live)
- Instructor approval workflow (draft → approved → rejected)

---

## Infrastructure

| Component | Detail |
|-----------|--------|
| Service | `apps/services/ivas-service/` — Python FastAPI, Poetry, multi-stage Dockerfile |
| Database | **Dedicated** `ivas-postgres` container (port 5434), own PostgreSQL instance |
| Redis | Session state (`ivas:session:{id}`), TTL-based expiry |
| MinIO | `ivas-audio` bucket for enrollment + viva recordings |
| Traefik | Routes `/api/v1/ivas/*` + `/ws/ivas/*` → port 8088 |
| Model | Resemblyzer bundled at `/app/models/` in container |

### DB Tables
- `assignments`, `grading_criteria`, `questions` — question bank
- `sessions`, `question_instances`, `student_responses` — viva data
- `voice_profiles` — speaker embeddings
- `voice_auth_events` — per-answer verification results
- `transcripts` — full conversation records + audio references

---

## Frontend (Fresh Redesign)

- **New** voice enrollment page (student records samples, progress tracking)
- **New** viva session page (WebSocket audio streaming, AI voice playback, live transcript)
- **New** results page (white-box scores, competency breakdown, evidence)
- **New** instructor review page (transcript, audio playback, voice auth anomalies, grading details)
- **Update** admin settings page (provider config, health check)
- **New** API client + types to match the redesigned backend

---

## Build Order

| Phase | What | Status |
|-------|------|--------|
| **1** | Service scaffold — FastAPI + Docker + compose.yaml + DB schema + health check | ✅ |
| **2** | Assignment & question management REST APIs | ✅ |
| **3** | Voice enrollment module (Resemblyzer + enrollment flow) | ✅ |
| **4** | Live viva engine — Gemini Live API WebSocket integration | |
| **5** | Technical term accuracy layers (prompt + code grounding + post-hoc) | |
| **6** | Voice verification during viva (per-answer check) | |
| **7** | White-box grading & transcript storage | |
| **8** | Frontend — enrollment page, viva page, results, instructor review | |

---

## Verification
- `docker compose up ivas-service ivas-postgres` starts clean
- Health check at `/api/v1/ivas/health`
- Enrollment: record → store embedding → verify exists
- Viva: start session → voice Q&A → graded results with justifications
- Transcript stored with per-question reasoning
- Voice auth events logged per answer
- Instructor sees full transcript + scores + voice auth flags
