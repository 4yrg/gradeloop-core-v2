# GradeLoop Core v2 — database ER overview

This document maps **PostgreSQL** schemas used by the monorepo. The stack is **multi-database**: foreign keys never cross database boundaries. Many columns store **UUIDs or text IDs** that logically reference another service; those links are summarized in the **logical** diagram at the end, not as `erDiagram` relationships.

**Conventions**

- **PK** / **FK** in attribute lists reflect **enforced** keys in code (GORM / SQLAlchemy / `CREATE TABLE`) as read from the repo at authoring time.
- **UUID logical ref** = no DB-level FK; resolved at application layer.
- **Soft delete**: IAM `users` uses GORM `DeletedAt`; academic tables may use nullable `deleted_at`.
- **JSONB** columns are collapsed to a single attribute line where useful for readability.
- **Mermaid diagrams** in this file share a `theme: base` init tuned for **light** backgrounds (high-contrast text and lines). In dark-themed editors, you may prefer local overrides or switching the diagram theme.

---

## Inventory

| Database (typical `*_SVC_DB_NAME`) | Owning area | Authoritative sources |
|-----------------------------------|-------------|------------------------|
| `iam_db` | IAM service | [`apps/services/iam/internal/domain/models.go`](../apps/services/iam/internal/domain/models.go) |
| `academic_db` | Academic service | [`apps/services/academic/internal/domain/`](../apps/services/academic/internal/domain/) |
| `assessment_db` | Assessment service | [`apps/services/assessment/internal/domain/`](../apps/services/assessment/internal/domain/) |
| `acafs_db` | ACAFS service | [`apps/services/acafs/app/models.py`](../apps/services/acafs/app/models.py), [`postgres_client.py`](../apps/services/acafs/app/services/storage/postgres_client.py) |
| `email_db` | Email service | [`apps/services/email/internal/domain/models.go`](../apps/services/email/internal/domain/models.go) |
| `notification_db` | Notification service | [`apps/services/notification/internal/domain/models.go`](../apps/services/notification/internal/domain/models.go) |
| `cipas_db` | CIPAS Syntactics (shared DB name in compose) | [`apps/services/cipas-syntactics/models.py`](../apps/services/cipas-syntactics/models.py) |
| `cipas_ai_db` | CIPAS AI (inference) | No relational app schema — PyTorch models only ([`apps/services/cipas-ai/src/models.py`](../apps/services/cipas-ai/src/models.py)) |
| `keystroke-db` | Keystroke service (separate Postgres instance in compose) | [`apps/services/keystroke/schema.sql`](../apps/services/keystroke/schema.sql) |
| `ivas_db` | IVAS (optional / when deployed) | [`apps/services/ivas/app/services/storage/postgres_client.py`](../apps/services/ivas/app/services/storage/postgres_client.py) (`SCHEMA_SQL`) |

---

## `iam_db` — IAM service

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    users {
        uuid id PK
        string email UK
        string user_type
        bool is_active
        datetime deleted_at
    }
    user_profile_students {
        uuid user_id PK
        string student_id UK
    }
    user_profile_instructors {
        uuid user_id PK
        string designation
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        datetime expires_at
    }
    password_reset_tokens {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        datetime expires_at
    }

    users ||--o| user_profile_students : "user_id"
    users ||--o| user_profile_instructors : "user_id"
    users ||--o{ refresh_tokens : "user_id"
    users ||--o{ password_reset_tokens : "user_id"
```

---

## `academic_db` — Academic service

The schema is split into **two** ER diagrams so each renders larger in viewers (GitHub, VS Code, Mermaid Live Editor). Use **SVG export** or zoom if text still feels small: `npx @mermaid-js/mermaid-cli -i docs/database-er.md -o out.svg` (see [Drift and tooling](#drift-and-tooling)).

### A — Org structure, degrees, batches, cohort membership

Logical IAM link: `batch_members.user_id` → `users.id` (no FK in this database).

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    faculties {
        uuid id PK
        string code UK
        string name
        bool is_active
    }
    departments {
        uuid id PK
        uuid faculty_id FK
        string code
        string name
        bool is_active
    }
    degrees {
        uuid id PK
        uuid department_id FK
        string code
        string name
        string level
        bool is_active
    }
    specializations {
        uuid id PK
        uuid degree_id FK
        string code
        string name
        bool is_active
    }
    batches {
        uuid id PK
        uuid parent_id FK
        uuid degree_id FK
        uuid specialization_id FK
        string code
        string name
        bool is_active
    }
    batch_members {
        uuid batch_id PK
        uuid user_id PK
        string status
        datetime enrolled_at
    }

    faculties ||--o{ departments : "faculty_id"
    departments ||--o{ degrees : "department_id"
    degrees ||--o{ specializations : "degree_id"
    degrees ||--o{ batches : "degree_id"
    specializations ||--o| batches : "specialization_id"
    batches ||--o{ batches : "parent_id"
    batches ||--o{ batch_members : "batch_id"
```

### B — Course catalog, prerequisites, offerings, instructors, enrollments

Logical links (no FK in `academic_db`): `course_instances.course_id` → `courses.id`, `course_instances.semester_id` → `semesters.id`, `course_instructors.user_id` and `enrollments.user_id` → IAM `users.id`.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    semesters {
        uuid id PK
        string code UK
        string term_type
        string status
        bool is_active
    }
    courses {
        uuid id PK
        string code UK
        string title
        int credits
        bool is_active
    }
    course_prerequisites {
        uuid course_id PK
        uuid prerequisite_course_id PK
    }
    batches {
        uuid id PK
        string code
        string name
    }
    course_instances {
        uuid id PK
        uuid course_id
        uuid semester_id
        uuid batch_id FK
        string status
        int max_enrollment
    }
    course_instructors {
        uuid course_instance_id PK
        uuid user_id PK
        string role
    }
    enrollments {
        uuid course_instance_id PK
        uuid user_id PK
        string status
        string final_grade
        datetime enrolled_at
    }

    courses ||--o{ course_prerequisites : "course_id"
    courses ||--o{ course_prerequisites : "prerequisite_course_id"
    batches ||--o{ course_instances : "batch_id"
    course_instances ||--o{ course_instructors : "course_instance_id"
    course_instances ||--o{ enrollments : "course_instance_id"
```

`batches` is repeated in **diagram B** with only key columns so `course_instances` → `batches` can be drawn; the full batch hierarchy stays in **diagram A**.

| Table | Primary key | Foreign keys (enforced in DB) |
|-------|-------------|-------------------------------|
| `faculties` | `id` | — |
| `departments` | `id` | `faculty_id` → `faculties` |
| `degrees` | `id` | `department_id` → `departments` |
| `specializations` | `id` | `degree_id` → `degrees` |
| `batches` | `id` | `parent_id` → `batches`, `degree_id` → `degrees`, `specialization_id` → `specializations` |
| `batch_members` | (`batch_id`, `user_id`) | `batch_id` → `batches` |
| `semesters` | `id` | — |
| `courses` | `id` | — |
| `course_prerequisites` | (`course_id`, `prerequisite_course_id`) | both → `courses` |
| `course_instances` | `id` | `batch_id` → `batches` |
| `course_instructors` | (`course_instance_id`, `user_id`) | `course_instance_id` → `course_instances` |
| `enrollments` | (`course_instance_id`, `user_id`) | `course_instance_id` → `course_instances` |

---

## `assessment_db` — Assessment service

GORM does not tag these structs with `foreignKey`, so Postgres may or may not enforce referential integrity; the lines below show **application-level** relationships (same as service joins).

Entity **`assignment_groups`** is the ER label for the physical table **`groups`** (`SubmissionGroup` in Go) — the name `groups` is avoided in Mermaid because it can break parsers.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    assignments {
        uuid id PK
        uuid course_instance_id
        uuid created_by
        string title
        bool is_active
    }
    assignment_rubric_criteria {
        uuid id PK
        uuid assignment_id
        string grading_mode
    }
    assignment_test_cases {
        uuid id PK
        uuid assignment_id
    }
    assignment_sample_answers {
        uuid id PK
        uuid assignment_id
    }
    submissions {
        uuid id PK
        uuid assignment_id
        uuid user_id
        uuid group_id
        string status
    }
    assignment_groups {
        uuid id PK
        uuid assignment_id
    }
    code_repos {
        uuid id PK
        uuid assignment_id
        uuid user_id
    }
    code_versions {
        uuid id PK
        uuid code_repo_id
        uuid assignment_id
        uuid user_id
    }
    assignment_code_configs {
        uuid id PK
        uuid assignment_id
    }

    assignments ||--o{ assignment_rubric_criteria : "assignment_id"
    assignments ||--o{ assignment_test_cases : "assignment_id"
    assignments ||--o| assignment_sample_answers : "assignment_id"
    assignments ||--o{ submissions : "assignment_id"
    assignments ||--o{ assignment_groups : "assignment_id"
    assignments ||--o{ code_repos : "assignment_id"
    assignments ||--o| assignment_code_configs : "assignment_id"
    code_repos ||--o{ code_versions : "code_repo_id"
    assignment_groups ||--o{ submissions : "group_id"
```

Physical table name for cohorts: **`groups`**. `assignment_sample_answers.assignment_id` and `assignment_code_configs.assignment_id` are unique at most one row per assignment in normal use.

---

## `acafs_db` — ACAFS service

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    acafs_results {
        int id PK
        uuid submission_id UK
        uuid assignment_id
        json ast_blueprint
    }
    submission_grades {
        int id PK
        uuid submission_id UK
        uuid assignment_id
        float total_score
    }
    submission_criteria_scores {
        int id PK
        uuid submission_id FK
        string criterion_name
    }
    chat_sessions {
        uuid id PK
        uuid assignment_id
        string user_id
        string status
    }
    chat_messages {
        int id PK
        uuid session_id FK
        string role
    }

    submission_grades ||--o{ submission_criteria_scores : "submission_id"
    chat_sessions ||--o{ chat_messages : "session_id"
```

---

## `email_db` — Email service

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    email_templates {
        uuid id PK
        string name UK
        bool is_active
    }
    email_messages {
        uuid id PK
        uuid template_id FK
        string status
    }
    email_recipients {
        uuid id PK
        uuid message_id FK
        string email
    }
    email_attachments {
        uuid id PK
        uuid message_id FK
        string filename
    }
    email_logs {
        uuid id PK
        uuid message_id FK
        string event
    }

    email_messages }o--o| email_templates : "template_id"
    email_messages ||--o{ email_recipients : "message_id"
    email_messages ||--o{ email_attachments : "message_id"
    email_messages ||--o{ email_logs : "message_id"
```

`email_messages.template_id` is nullable; cardinality uses `}o--o|` to `email_templates`.

---

## `notification_db` — Notification service

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    notifications {
        uuid id PK
        uuid user_id
        string type
        bool is_read
        datetime created_at
    }
```

The database column is `read` (Go `Read`); the diagram uses `is_read` because `read` can clash with Mermaid grammar in some parsers.

---

## `cipas_db` — CIPAS Syntactics

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    assignment_templates {
        uuid id PK
        text assignment_id UK
    }
    fragments {
        uuid id PK
        text submission_id
        text assignment_id
    }
    plagiarism_groups {
        uuid id PK
        text assignment_id
    }
    clone_matches {
        uuid id PK
        uuid frag_a_id FK
        uuid frag_b_id FK
        text assignment_id
    }
    lsh_bucket_metadata {
        uuid id PK
        uuid fragment_id FK
    }
    similarity_reports {
        uuid id PK
        text assignment_id UK
    }
    instructor_annotations {
        uuid id PK
        uuid match_id FK
        uuid group_id FK
    }
    report_exports {
        uuid id PK
        uuid report_id FK
    }

    clone_matches }|--|| fragments : "frag_a_id"
    clone_matches }|--|| fragments : "frag_b_id"
    fragments ||--o{ lsh_bucket_metadata : "fragment_id"
    clone_matches ||--o{ instructor_annotations : "match_id"
    plagiarism_groups ||--o{ instructor_annotations : "group_id"
    similarity_reports ||--o{ report_exports : "report_id"
```

`assignment_templates`, `fragments`, `plagiarism_groups`, and `similarity_reports` reference **assessment** entities by **text UUID** only (no cross-database FK).

---

## `cipas_ai_db`

No first-party relational tables for application data — the service loads **ML weights** for inference. Compose may still provision an empty database URL for operational symmetry.

---

## Keystroke database (`keystroke-db`)

Tables are independent; **no enforced FKs** between `user_biometrics`, `auth_events`, `keystroke_archives`, and `enrollment_progress`. Links are by `user_id` / `session_id` / `assignment_id` strings.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    user_biometrics {
        int id PK
        string user_id
        string enrollment_phase
        bytea template_data
    }
    auth_events {
        int id PK
        uuid event_id
        string user_id
        string session_id
        string assignment_id
    }
    keystroke_archives {
        int id PK
        uuid archive_id
        string user_id
        string session_id UK
    }
    enrollment_progress {
        int id PK
        string user_id UK
        bool enrollment_complete
    }
```

---

## `ivas_db` — IVAS (when enabled)

Schema is defined in **embedded SQL** in the IVAS Postgres client. IVAS **`assignments`** / **`grading_criteria`** / **`questions`** are **not** the same tables as assessment `assignments`.

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
erDiagram
    ivas_sessions {
        uuid id PK
        uuid assignment_id
        string student_id
        string status
    }
    question_instances {
        uuid id PK
        uuid session_id FK
        int sequence_num
    }
    student_responses {
        uuid id PK
        uuid question_instance_id FK
        uuid session_id FK
    }
    transcripts {
        uuid id PK
        uuid session_id FK
        string role
    }
    voice_profiles {
        uuid id PK
        string student_id UK
    }
    voice_auth_events {
        uuid id PK
        uuid session_id FK
        uuid question_instance_id FK
    }
    competencies {
        uuid id PK
        string name UK
    }
    competency_assignments {
        uuid id PK
        uuid competency_id FK
        uuid assignment_id
    }
    competency_scores {
        uuid id PK
        uuid competency_id FK
        uuid session_id FK
        string student_id
    }
    ivas_assignments {
        uuid id PK
        string instructor_id
    }
    grading_criteria {
        uuid id PK
        uuid assignment_id FK
    }
    ivas_questions {
        uuid id PK
        uuid assignment_id FK
        uuid criteria_id FK
    }

    ivas_sessions ||--o{ question_instances : "session_id"
    ivas_sessions ||--o{ student_responses : "session_id"
    ivas_sessions ||--o{ transcripts : "session_id"
    ivas_sessions ||--o{ voice_auth_events : "session_id"
    question_instances ||--o{ student_responses : "question_instance_id"
    question_instances ||--o{ voice_auth_events : "question_instance_id"
    competencies ||--o{ competency_assignments : "competency_id"
    competencies ||--o{ competency_scores : "competency_id"
    ivas_sessions ||--o{ competency_scores : "session_id"
    ivas_assignments ||--o{ grading_criteria : "assignment_id"
    ivas_assignments ||--o{ ivas_questions : "assignment_id"
    grading_criteria ||--o{ ivas_questions : "criteria_id"
```

Entity names `ivas_assignments` and `ivas_questions` are **aliases** in this diagram only; physical table names are `assignments` and `questions` inside `ivas_db`.

---

## Logical cross-service references (not enforced in SQL)

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontSize':'17px','fontFamily':'system-ui','primaryTextColor':'#111111','secondaryTextColor':'#2d2d2d','tertiaryTextColor':'#444444','lineColor':'#3a3a3a','primaryColor':'#cfe2ff','secondaryColor':'#e3edfc','tertiaryColor':'#eef3fa'}}}%%
flowchart TB
    subgraph iamDb[iam_db]
        users[users.id]
    end
    subgraph academicDb[academic_db]
        batch_members[batch_members.user_id]
        course_instructors[course_instructors.user_id]
        enrollments[enrollments.user_id]
        course_instances[course_instances]
    end
    subgraph assessmentDb[assessment_db]
        assignments[assignments.course_instance_id]
        submissions[submissions.user_id]
        assessment_groups_node["groups table"]
        code_repos[code_repos.user_id]
    end
    subgraph acafsDb[acafs_db]
        chat_sessions[chat_sessions.user_id]
        acafs_grades[submission_grades.assignment_id]
    end
    subgraph notificationDb[notification_db]
        notifications[notifications.user_id]
    end
    subgraph keystrokeDb[keystroke-db]
        ks_user[auth_events.user_id]
    end
    subgraph cipasDb[cipas_db]
        fragments[fragments.student_id]
    end

    users -->|"UUID"| batch_members
    users -->|"UUID"| course_instructors
    users -->|"UUID"| enrollments
    users -->|"UUID"| submissions
    users -->|"UUID"| code_repos
    users -->|"text"| chat_sessions
    users -->|"UUID"| notifications
    users -->|"string"| ks_user
    users -->|"text"| fragments

    course_instances -->|"UUID course_instance_id"| assignments
    enrollments -->|"same user in course"| submissions

    assignments -->|"UUID assignment_id"| submissions
    assignments -->|"UUID"| assessment_groups_node
    assignments -->|"UUID"| code_repos
    assignments -->|"UUID"| acafs_grades
    assignments -->|"text"| fragments

    submissions -->|"UUID submission_id"| acafs_grades
```

---

## Drift and tooling

- **Drift**: If migrations or `AutoMigrate` change without updating this file, diagrams become stale. Prefer updating this doc when domain models change.
- **Optional automation**: [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli) (`mmdc`) for PNG/SVG, or [tbls](https://github.com/k1LoW/tbls) against a live database for diff checks.
