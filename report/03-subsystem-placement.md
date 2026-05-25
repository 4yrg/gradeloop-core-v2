# Phase 3 — Subsystem Placement Analysis

## Overview

The following four subsystems are documented as architectural modules. Implementation details, internal algorithms, model architectures, and proprietary logic are intentionally abstracted. Only architectural placement, purpose, interfaces, and system-level interactions are described.

---

## 1. ACAFS — Automated Code Analysis & Feedback System

### Purpose
ACAFS is an event-driven code grading engine that automates the assessment of student programming submissions. It performs test-case scoring, LLM-based code analysis, and provides a Socratic chat tutor for interactive feedback.

### Architectural Placement
- **Layer**: Application Layer — Backend Microservice
- **Language/Framework**: Python 3.11 / FastAPI
- **Port**: 8102
- **Gateway Path**: `/api/v1/acafs/*`

### Connected Services & Dependencies
| Dependency | Role | Communication |
|-----------|------|---------------|
| **Assessment Service** | Receives submission events | RabbitMQ (event: `submission.created`) |
| **MinIO / SeaweedFS** | Retrieves student code submissions | S3-compatible API |
| **Judge0** | Executes test cases against submissions | HTTPS/REST |
| **OpenRouter** | LLM reasoning (Qwen3) | HTTPS/REST |
| **Gemini API** | Structured grading output | HTTPS/REST |
| **PostgreSQL** | Stores grading results and analysis | SQL |

### Inputs and Outputs
- **Inputs**: RabbitMQ `submission.created` events, student code from MinIO, test case definitions
- **Outputs**: Grading results (scores, feedback, analysis), Socratic chat responses

### Role in Complete System
Provides the automated assessment pipeline within the Grading subsystem, reducing manual grading workload for instructors while delivering immediate feedback to students.

---

## 2. CIPAS — Code Integrity & Plagiarism Analysis Service

### Purpose
CIPAS is a multi-engine code integrity analysis system that detects different forms of code plagiarism and AI-generated code across student submissions. It comprises three specialized detection engines.

### Sub-Engines

| Engine | Port | Purpose | Technology |
|--------|------|---------|------------|
| **CIPAS-Syntactics** | 8106 | Type-1, Type-2, Type-3 syntactic clone detection | XGBoost + NiCAD (Tree-sitter) |
| **CIPAS-Semantics** | 8105 | Semantic clone detection (functionally equivalent code) | GraphCodeBERT (PyTorch) |
| **CIPAS-AI** | 8104 | AI-generated code detection | UniXcoder (PyTorch) |
| **CIPAS-XAI** | 8085 | LLM proxy for explainability and chat | Go / Fiber (OpenAI-compatible) |

### Architectural Placement
- **Layer**: Application Layer — Backend Microservices (4 services)
- **Language**: Python (cipas-ai, cipas-semantics, cipas-syntactics), Go (cipas-xai)
- **Gateway Paths**: `/api/v1/ai/*`, `/api/v1/semantics/*`, `/api/v1/syntactics/*`, `/api/v1/xai/*`

### Connected Services & Dependencies
| Dependency | Role | Communication |
|-----------|------|---------------|
| **Assessment Service** | Receives submission data for analysis | REST via Kong |
| **PostgreSQL** | Stores analysis reports, clone classes, evidence | SQL |
| **Instructor UI** | Presents similarity graphs, diff views | REST via Kong |
| **OpenRouter** | LLM provider for CIPAS-XAI | HTTPS/REST |

### Inputs and Outputs
- **Inputs**: Code submissions, analysis trigger requests, threshold configurations
- **Outputs**: Clone detection reports, similarity scores, collusion graphs, evidence bundles, AI-detection likelihood scores

### Role in Complete System
Provides the academic integrity assurance subsystem, enabling instructors to detect plagiarism, identify collusion networks, and verify authorship authenticity across programming assignments.

---

## 3. BLAIM — Behavioral Biometrics & Learner Integrity Monitoring

### Purpose
BLAIM is a keystroke dynamics-based behavioral biometrics system that continuously authenticates students during online assessments and monitors behavioral patterns for academic integrity.

### Architectural Placement
- **Layer**: Application Layer — Backend Microservice
- **Language/Framework**: Python 3.11 / FastAPI
- **Port**: 8103
- **Gateway Paths**: `/api/keystroke/*`, `/ws/monitor/*`

### Connected Services & Dependencies
| Dependency | Role | Communication |
|-----------|------|---------------|
| **PostgreSQL (keystroke)** | Stores enrollment profiles and session data | SQL |
| **Redis** | Manages active sessions and temporary state | Redis protocol |
| **RabbitMQ** | Publishes behavioral analysis events | AMQP |
| **Gemini API** | Behavioral analysis and cognitive load assessment | HTTPS/REST |
| **Frontend (Monaco Editor)** | Captures keystroke events via custom hook | REST + WebSocket |

### Inputs and Outputs
- **Inputs**: Keystroke timing data (key down/up events), enrollment typing samples, session monitoring data
- **Outputs**: Verification scores, identification results, behavioral analysis reports, authenticity scores, cognitive load metrics

### Role in Complete System
Provides continuous authentication and behavioral monitoring during online assessments. This subsystem addresses the challenge of verifying student identity throughout an assessment session (not just at login), detecting potential impersonation or unauthorized assistance.

---

## 4. IVAS — Intelligent Viva Assessment System

### Purpose
IVAS is an AI-powered voice-based oral examination system that conducts live viva voce assessments. It uses real-time bidirectional voice communication via Gemini Live API, speaker verification for identity confirmation, and automated grading.

### Architectural Placement
- **Layer**: Application Layer — Backend Microservice
- **Language/Framework**: Python 3.11 / FastAPI
- **Port**: 8101
- **Gateway Paths**: `/api/v1/ivas/*`, `/ws/ivas/session/*`

### Connected Services & Dependencies
| Dependency | Role | Communication |
|-----------|------|---------------|
| **PostgreSQL (dedicated, 5434)** | Stores session data, questions, grading criteria | SQL |
| **Redis** | Manages active session state | Redis protocol |
| **RabbitMQ** | Publishes assessment completion events | AMQP |
| **MinIO / SeaweedFS** | Stores audio recordings | S3-compatible API |
| **Gemini Live API** | Real-time bidirectional voice AI | WebSocket |
| **Resemblyzer** | Speaker verification (voiceprint matching) | Python library |
| **Frontend** | Browser-based audio capture and playback | WebSocket + REST |

### Inputs and Outputs
- **Inputs**: Real-time audio streams, voice enrollment samples, assignment configurations
- **Outputs**: Graded responses, transcripts, voice verification results, competency scores

### Role in Complete System
Provides an alternative assessment modality to traditional written exams. IVAS enables automated oral examination at scale, with capabilities for adaptive questioning, real-time speaker verification, and objective grading — addressing the logistical challenges of conducting viva assessments in large classes.

---

## Subsystem Interaction Summary

```
Frontend (Next.js)
    ↕ REST/WS via Kong Gateway (8000)
    │
    ├──→ IAM (8081) ───→ PostgreSQL
    ├──→ Academic (8083) ───→ PostgreSQL
    ├──→ Assessment (8084) ───→ PostgreSQL, MinIO, RabbitMQ
    │       │
    │       ├──(event)──→ ACAFS (8102) ───→ MinIO, Judge0, OpenRouter, Gemini
    │       ├──(event)──→ CIPAS (8104-8106) ───→ PostgreSQL
    │       └──(event)──→ BLAIM/Keystroke (8103) ───→ PostgreSQL, Redis
    │
    ├──→ IVAS (8101) ───→ PostgreSQL, Redis, MinIO, Gemini Live
    ├──→ Notification (8086) ───→ PostgreSQL, Redis, RabbitMQ
    ├──→ CIPAS-XAI (8085) ───→ OpenRouter
    └──→ Email (8082) ───→ PostgreSQL, RabbitMQ, SMTP
```
