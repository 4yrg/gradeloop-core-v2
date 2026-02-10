# Code Review Policy

This document describes the Gradeloop team's code review policy: goals, roles, reviewer responsibilities, review checklist, approval rules, exceptions, and auditability expectations. It pairs with `docs/git-workflow.md` and the PR template at `.github/PULL_REQUEST_TEMPLATE.md`.

Purpose
- Ensure correctness, maintainability, security, and traceability of changes.
- Preserve separation of duties and audit trails for academic-data handling.
- Provide fast, respectful, and actionable feedback to contributors.

Scope
- Applies to all changes that modify repository code, configuration, tests, or infrastructure-as-code.
- PRs targeting `main` must follow the rules in this policy.

Key Requirements
- PRs targeting `main` require:
  - Passing CI status checks configured for the repo.
  - At least 2 approving reviews from different people.
  - Approvals are dismissed if the PR receives new commits.
  - The PR body must include a valid `GRADLOOP-*` Jira key (enforced by `jira-link-check` or equivalent).
  - The PR author must not be one of the approvers (separation of duties).
- Direct pushes to `main` are disallowed.
- Branch protection settings must reflect the above enforcement.

Roles & Responsibilities

Author (PR creator)
- Open small, focused PRs that link to a single Jira issue (`GRADLOOP-*`).
- Use the repository PR template (`.github/PULL_REQUEST_TEMPLATE.md`).
- Include clear description, testing steps, and any relevant screenshots or logs.
- Run tests and linters locally before opening the PR.
- Add relevant assignees and suggest reviewers via `CODEOWNERS` or GitHub reviewer UI.
- Address review comments promptly and respond to reviewers when decisions are made.

Reviewer
- Validate the change against the Jira issue and acceptance criteria.
- Confirm tests and CI checks cover the change and pass.
- Evaluate for correctness, security, privacy (student data), performance, and style.
- For database changes: review migrations for up/down safety, potential data loss, and performance impacts.
- Provide clear, constructive comments. Prefer small, actionable suggestions.
- Approve only when satisfied that code is correct and tested.
- If you leave a major comment that causes the author to change code, re-run CI and re-approve once satisfied.

Tech Lead / Repository Admin
- Resolve disputes or architectural-level decisions when reviewers disagree.
- Approve exceptions (e.g., emergency merges, sole-contributor cases) and document them in PR comments.
- Maintain and update `CODEOWNERS`, branch protection rules, and required CI checks.
- Ensure auditors can access PR history and CI artifacts as required.

Reviewer Guidelines (Checklist)
When reviewing, use this checklist as a baseline. Prefer using the PR template and checklist items to track compliance.

Functional correctness
- Does the change implement the required behavior from the Jira issue?
- Are edge cases covered and handled safely?

Tests & CI
- Unit tests added/updated for new logic.
- Integration / end-to-end tests updated (if applicable).
- Tests are deterministic and fast where possible.
- CI passes for all required checks.

Security & Privacy
- No student-sensitive data exposed in logs, error messages, or assets.
- Input validation and authorization checks are present.
- Dependencies do not introduce known high/critical vulnerabilities.

Performance & Scalability
- Changes are reasonable in CPU/memory usage and scale for expected loads.
- Potentially expensive operations are documented with mitigation strategies.

Code Quality & Maintainability
- Code is readable, idiomatic, and documented where non-obvious.
- Proper separation of concerns and adherence to repository patterns.
- No dead code or commented-out blocks left behind.

Database & Migrations
- Migrations are reversible and tested (`up` and `down`).
- Data migrations handle large tables safely (batched or with maintenance windows).
- Schema changes are backward compatible where possible.

Documentation
- Public APIs, README, and docs updated when behavior changes.
- PR description and commit messages clearly reference the Jira key.

Release & Deployment
- Any deployment considerations are documented in the PR (`Deployment Notes`).
- Feature flags used if rolling out risky changes.

Approval Semantics
- "Approve" indicates you are satisfied the change meets the checklist and is safe to merge.
- "Request changes" indicates there are blocking issues; author must address them and request re-review.
- Approvals are considered stale and must be re-approved if additional commits are pushed.

Separation of Duties & Exceptions
- Normal rule: author cannot approve their own PR.
- Sole-contributor service: tech lead acts as the second reviewer. This arrangement must be documented in the service README and approved by the platform admin.
- Emergency hotfix: see `docs/emergency-merge.md`. In emergencies, the tech lead or on-call senior may act as the second reviewer. The emergency reason and post-merge review obligations must be recorded in the PR within 24 hours.

Code Owners & Automatic Review Assignment
- Use `CODEOWNERS` to assign default reviewers for specific paths. Example entry:
  - `docs/ @gradeloop/docs-team`
  - `services/api/** @gradeloop/backend-team`
- CODEOWNERS helps ensure appropriate subject matter experts review changes promptly, but human reviewers must still verify compliance.

Review Turnaround Times
- Aim to review small PRs within 24 business hours.
- If blocked for more than 48 hours, escalate to the tech lead or ping on the team's primary communication channel.

Handling Conflicts & Escalation
- If reviewers disagree on approach, discuss in PR comments first.
- If no resolution within 24–48 hours, escalate to the tech lead for an arbitration decision.
- All arbitration decisions should be documented in PR comments for auditability.

Automations & Required CI Checks
- Required checks should include (at a minimum):
  - `ci/unit` — unit tests
  - `linter` — style and static checks
  - `security-scan` — dependency and static analysis
  - `jira-link-check` — verifies a `GRADLOOP-\\d+` pattern in the PR body
- A lightweight GitHub Action or bot should:
  - Comment on PRs missing a Jira link and fail the `jira-link-check`.
  - Label PRs according to status (`needs-jira`, `needs-review`, `ready-to-merge`).
  - Optionally assign reviewers based on `CODEOWNERS` or mapping rules.

Auditability & Record Keeping
- Preserve PR history: do not delete or forcibly rewrite merged PRs; prefer merge commits or squash with clear messages including Jira keys.
- CI artifacts (test logs, security scan reports) should be retained according to institutional retention policy.
- Document any branch protection bypasses or admin merges in PR comments with rationale and timestamp.

Merging Strategy & Commit Messages
- Ensure the merged commit message references the Jira key (the PR title should include it).
- Team may choose one merge strategy and apply it consistently:
  - Merge commits: preserves PR as a merge event.
  - Squash merges: consolidates changes; ensure commit message includes Jira key and summary.
  - Rebase & merge: preserves linear history; still ensure Jira key in commit message.
- Whichever strategy is chosen, ensure the merge preserves traceability to Jira.

Best Practices for Authors (Quick Tips)
- Keep PRs small and focused.
- Run linters and tests locally before opening the PR.
- Use the PR template; fill checklist sections.
- Add a short summary in the first line of the PR body for quick scanning.
- Add `@user` mentions only when necessary to draw attention.

Privacy & Security Responsibilities
- Treat student data with high confidentiality and follow institutional policies.
- Do not include real student data in tests or logs. Use synthetic/fixture data only.
- Flag any change that affects data access controls for explicit security review.

Retrospective & Continuous Improvement
- Periodically review the policy (quarterly or after major incidents).
- Update `docs/code-review-policy.md`, `docs/git-workflow.md`, and `.github/PULL_REQUEST_TEMPLATE.md` as practices evolve.
- Collect metrics (PR size distribution, review latency, number of re-opened PRs) to identify process improvements.

Related Documents
- `docs/git-workflow.md` — branching and PR flow
- `.github/PULL_REQUEST_TEMPLATE.md` — PR template used by reviewers and auditors
- `docs/emergency-merge.md` — emergency/hotfix process
- `CODEOWNERS` — automatic reviewer mapping (when present in repo root)

Contacts & Escalation
- Tech lead(s): listed in repository README / team handbook.
- Platform admins: responsible for branch protection and required checks.
- Security contact: listed in security.md or repository README.

Versioning & Changes
- Document changes to this policy in the repository's changelog or a PR referencing a `GRADLOOP-*` Jira issue.
- When updating the policy, notify the team and update related automation (e.g., `jira-link-check`) if necessary.

---

End of code review policy.