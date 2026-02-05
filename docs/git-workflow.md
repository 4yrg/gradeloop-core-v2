# Git Workflow & Code Review Policy

This document describes the Git branching strategy, PR conventions, branch protection expectations, emergency merge process, and sample checks for the Gradeloop project. It explains how you should name branches, create PRs, and perform reviews so that every change is auditable and traceable to a Jira requirement.

Key locations
- PR template: `.github/PULL_REQUEST_TEMPLATE.md`
- This documentation: `docs/git-workflow.md`
- Emergency merge guidance: `docs/emergency-merge.md`
- Code review policy companion: `docs/code-review-policy.md` (summary included below)

Overview

- Our goal is predictable releases, clear traceability from Jira → code → approval, and enforcement of separation of duties for academic-data handling.
- We use PR-based merges into `main` for all production changes. Direct pushes to `main` are disallowed.
- All PRs that target `main` must be linked to a valid `GRADLOOP-*` Jira issue.

1) Branching Model

We follow a lightweight, Jira-key-driven branching model inspired by GitFlow but simplified for modern trunk-based practices where appropriate.

Primary branches
- `main` — production-ready. Protected. Always stable.
- `develop` — optional integration branch for staged work (used only if your service needs it). Not required for simple services.

Feature / work branches
- Branch pattern: `<JIRA_KEY>-<EPIC>-<USER_STORY_SHORT_TITLE>`
  - Example: `GRADLOOP-10-E01-US04-Documented-Branching-Strategy`
  - Use kebab-case (lowercase, hyphen separators). Remove special characters; keep it readable.
- Purpose:
  - Each branch represents a single Jira issue / user story (preferred).
  - Small, focused branches are easier to review and trace.

Hotfix branches
- Pattern: `hotfix/<JIRA_KEY>-short-title` (for emergency production fixes)
- Hotfixes may be merged with an exception workflow (see Emergency Merge).

Branch lifecycle
- Create branch from `main` (or `develop` if used).
- Push feature branch, open PR to `main`.
- Link PR to Jira issue using the issue key in either the PR title or body.
- When PR is merged, delete the branch (optional but recommended).

2) Branch naming examples

Use inline code style for clarity:
- `GRADLOOP-123-E02-US07-fix-bulk-upload`
- `GRADLOOP-10-E01-US04-documented-branching-strategy`
- `hotfix/GRADLOOP-999-critical-db-fix`

3) Pull Request Conventions

Every PR must:
- Use the repository PR template located at `.github/PULL_REQUEST_TEMPLATE.md`. The template pre-fills sections for:
  - Description
  - Related Issues (Jira link)
  - Type of Change
  - Changes Made
  - Testing steps
  - Checklist (style, tests, docs)
  - Deployment notes
- Include the Jira issue key in the PR title and Related Issues section. Example: `GRADLOOP-10: E01 US04 - Documented Branching Strategy`
- Include testing evidence (steps and, when applicable, screenshots or CI artifacts).
- Have a clear description of the change and why it is required.

How to open a PR
1. Push feature branch to origin:
   - `git push -u origin GRADLOOP-123-E02-implement-feature`
2. In GitHub, choose your branch and open a PR to `main`. The template will be applied.

4) Required Review & Approval Policy

Default protection (applies to `main`):
- Pull requests required (no direct pushes).
- CI status checks required — all configured GitHub Actions checks must pass before merge.
- At least 2 approving reviews required from different reviewers (engineers).
- Approvals dismissed when new commits are pushed.
- Enforce linear history (optional) — prefer rebase and merge or squash depending on repo policy.

Separation of duties
- Author cannot be an approver on their own PR. The branch protection should enforce this where supported.
- In single-contributor cases, an approval from the tech lead is required as the second reviewer. See "Sole-contributor exceptions".

Reviewer responsibilities
- Confirm code correctness, tests, and that the changes match the Jira issue.
- Check for security/privacy concerns related to student data.
- Validate CI results and review any relevant logs/artifacts.

5) Required checks and automation

Minimum required checks (examples — configure these as required status checks in GitHub):
- `ci/unit` — unit tests
- `ci/integration` — integration tests (if applicable)
- `linter` — code style/lint
- `security-scan` — static analysis SAST or dependency check
- `jira-link-check` — automation check that ensures the PR body contains a valid `GRADLOOP-*` link (see automation below)

Automation recommendations
- A bot (GitHub Action or Probot) should:
  - Post a comment and fail a check if the PR body does not reference a valid `GRADLOOP-*` Jira key.
  - Add labels like `needs-jira-link`, `needs-review`, `ready-to-merge`.
  - Optionally add required reviewers based on code owners or team maps.

Sample "PR checks" workflow (conceptual)
- On PR open / synchronize:
  - Run `jira-link-check`. If missing, bot comments and CI check fails.
  - Run `linter`.
  - Run `ci/unit`.
  - Run `security-scan`.
- On all checks passing and approvals >= 2, merge button is enabled (branch protection with required checks).

6) Example PR flow

- You create branch `GRADLOOP-55-E01-US10-add-validation`.
- Push and open PR to `main`. Template appears.
- You add a link to `https://gradeloop.atlassian.net/browse/GRADLOOP-55` in the Related Issues.
- The `jira-link-check` action passes.
- CI checks run; `ci/unit` passes.
- Two different engineers approve the PR.
- All status checks green; merge by squash/rebase per repo policy.
- Merge commit contains PR metadata and references the Jira key for traceability.

7) Emergency Merge (hotfix) — summary

Purpose: allow a time-sensitive fix to land in `main` quickly while preserving auditability and post-merge review.

Emergency merge policy (full doc in `docs/emergency-merge.md`)
- Preconditions:
  - Emergency described in Jira issue (create `GRADLOOP-*` issue if none exists).
  - Hotfix branch created: `hotfix/GRADLOOP-<id>-short-desc`
- Approval rule:
  - If normal 2-approval rule cannot be satisfied rapidly, tech lead or on-call senior engineer can approve as the second reviewer.
  - Document the exception in the PR title/body: `EMERGENCY: <summary>` and list the reason and risk.
- Merge steps:
  - Run CI checks locally or via a dedicated quick CI pipeline.
  - Merge using the protected PR flow (if branch protection allows bypass, only admins may bypass — minimize use).
  - Post-merge obligations:
    - A post-merge review must be performed within 24 hours and documented in the PR comments.
    - Create a retrospective note in the Jira ticket describing the emergency and mitigation.
- Audit trail:
  - All emergency merges must include the approver, timestamp, and reason in PR comments.

8) Sole-contributor exceptions

If a service has a single contributor (rare), follow this policy:
- The sole contributor must request approval from the tech lead for every PR before merging.
- The tech lead acts as the second approver to satisfy separation-of-duties.
- Document this arrangement in the service README and notify the team.

9) Auditing & Traceability

To support audits:
- Every PR must reference the Jira issue (GRADLOOP-*). Use the `Related Issues` block in the PR template.
- Preserve PR history — do not squash away meaningful review comments. Merge strategies should retain traceability metadata (we recommend `squash` with the Jira reference in the commit message or `merge` with PR title referencing the Jira key).
- CI artifacts (test results, security scans) should be retained by the CI system. Configure retention policies to keep these artifacts as required by institutional rules.

10) Enforcement via GitHub Branch Protection (sample settings to apply)

Apply these settings to `main` (examples to configure in GitHub GUI or via API):
- Require pull request reviews before merging — enabled
  - Require review from Code Owners — optional (if CODEOWNERS is used)
  - Require at least 2 approving reviews from different people
  - Dismiss stale approvals when new commits are pushed — enabled
  - Restrict who can dismiss reviews — project admins only
- Require status checks to pass before merging — enabled
  - Add required checks: `ci/unit`, `ci/integration`, `linter`, `security-scan`, `jira-link-check`
- Require branches to be up to date before merging — enabled (optional: enforce to require merge from latest `main`)
- Include administrators — off for enforcement, on for audit (decide per org policy)
- Block force pushes — enabled
- Restrict push access — only trusted automation accounts (admins) if required

11) PR Template & Checklist mapping

The existing `.github/PULL_REQUEST_TEMPLATE.md` contains the sections auditors and reviewers expect. When you make a PR, ensure the template's checklist is completed:
- Tests: Are both unit and integration tests present / passing?
- Docs: If behavior changed, is `docs/git-workflow.md` / service README updated?
- Database: Any migrations documented and reversible?
- Dependencies: New dependencies approved?

12) Common edge cases & responses

- PR omits Jira link:
  - Bot comments and `jira-link-check` fails. PR cannot be merged until a valid `GRADLOOP-*` link is added.
- New commits after approvals:
  - Approvals are dismissed. Reviewers must re-approve after changes.
- Emergency hotfix:
  - Use `hotfix/*` pattern and follow Emergency Merge policy.
- Sole contributor:
  - Tech lead must approve as second reviewer.

13) Best Practices (you should follow)

- Keep PRs small and focused; aim for reviewable units < 300 lines changed.
- Link PR to Jira issue and include testing steps in the PR body.
- Write descriptive PR titles: start with the Jira key.
- Use `CODEOWNERS` for automatic reviewer suggestions where appropriate.
- Use GitHub protected branches to enforce rules consistently.

14) Troubleshooting & admin notes

- If a legitimate PR is blocked by branch protection and you are an admin needing to bypass for a release, document the bypass reason in the PR comments and notify auditors.
- For configuration changes to branch protection (e.g., adding required checks), coordinate with the platform admin team and update this document.

15) Appendix — Example PR title and body (summary)

Title:
`GRADLOOP-10: E01 US04 - Documented Branching Strategy`

Related Issues:
`Jira: https://gradeloop.atlassian.net/browse/GRADLOOP-10`

Short body (template will contain full sections):
- Description: Brief summary
- Testing: Steps to reproduce and test
- Checklist: Completed items marked with `x`

16) Where to update these rules

- Update `docs/git-workflow.md` for process and policy changes.
- Update `.github/PULL_REQUEST_TEMPLATE.md` for template changes.
- For branch protection and checks, update GitHub repository settings or the organization policy repos / automation scripts, and document changes here.

If you want, I can:
- Draft the `docs/emergency-merge.md` companion file with a formal step-by-step emergency policy.
- Provide a sample GitHub Actions `jira-link-check` implementation (Action workflow YAML) and example `CODEOWNERS` entries.

End of document.