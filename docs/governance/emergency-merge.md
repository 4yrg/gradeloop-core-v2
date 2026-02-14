# Emergency Merge (Hotfix) Policy

Purpose
-------
This document describes the controlled process for emergency merges (hotfixes) into `main`. It exists to balance the need for rapid fixes in production with the requirement for traceability, separation-of-duties, and auditability required by the project and institutional policies.

Scope
-----
Applies to any change that must be deployed quickly to production (or to a production-equivalent branch) to fix a critical bug, security vulnerability, or incident affecting availability, integrity, or confidentiality of student data.

Definitions
-----------
- Hotfix: a code change intended to resolve an urgent production issue.
- Emergency Merge: the act of merging a hotfix into `main` via an expedited process that may relax normal lead time for approvals while preserving documentation and post-merge review obligations.
- Tech Lead: the senior engineer or designated approver who can act as the required second approver when normal reviewer availability cannot be met.

Principles
----------
- Do not bypass traceability: every emergency change must reference a `GRADLOOP-*` Jira issue.
- Preserve separation-of-duties where possible: the PR author cannot be the only approver.
- Minimize bypasses of branch protection; when a bypass is used, record justification in the PR and in the Jira ticket.
- Post-merge review and documentation are mandatory and must be completed within 24 hours.

Preconditions (what you must do before an emergency merge)
----------------------------------------------------------
1. Create a Jira issue with a `GRADLOOP-*` key describing the problem. If a Jira ticket does not exist, create one immediately. The ticket should include:
   - Incident summary
   - Impact assessment
   - Risk of the fix
   - Planned rollback criteria
2. Create a dedicated hotfix branch from `main` following the naming guidance:
   - `hotfix/GRADLOOP-<id>-short-desc` (e.g., `hotfix/GRADLOOP-412-critical-db-fix`)
3. Keep the scope as small and focused as possible — a single change addressing the emergency.

Emergency Merge Workflow
------------------------
Follow these steps when you need to land a hotfix quickly.

1. Branch and implement
   - Create the hotfix branch: `git checkout -b hotfix/GRADLOOP-412-critical-db-fix`
   - Implement the minimal change required to resolve the issue.

2. Open a Pull Request (PR) to `main`
   - Use the repository PR template. Prefix the PR title with `EMERGENCY:` (recommended) and include the Jira key in the title and Related Issues section. Example:
     - Title: `EMERGENCY: GRADLOOP-412 - Fix crash on bulk upload`
     - Related Issues: `Jira: https://gradeloop.atlassian.net/browse/GRADLOOP-412`
   - In the PR body, include:
     - A clear explanation of the issue and why the change is urgent.
     - The exact deployment steps and any feature-flag toggles.
     - Rollback steps and conditions.
     - A list of the tests run (manual quick checks or CI artifacts).

3. Required checks and approvals
   - Run CI. If the normal CI suite would take too long, at minimum run a rapid smoke test pipeline or the critical checks that validate the fix. Document what was run.
   - Approvals:
     - If two independent approvers are available as usual, follow the normal rule (2 approvals).
     - If you cannot get two approvers quickly, the tech lead or on-call senior engineer can serve as the required second approver. The tech lead must be a different person than the author.
   - The PR author must not be the only approver.

4. Merge
   - Merge using the repository's protected merge method (maintainability of history is important — preserve the Jira reference).
   - If branch protection rules prevent merge and you are an admin forced to bypass for an emergency, record the bypass reason in the PR comments and in the Jira ticket.

Post-merge Obligations (must be completed within 24 hours)
---------------------------------------------------------
1. Post-merge review
   - The author and at least one reviewer (preferably someone other than the tech lead who approved) must perform a full review of the merged change and confirm:
     - Tests and CI artifacts are sufficient.
     - No unintended side effects were introduced.
   - Record the post-merge review findings in the PR comments.

2. Update Jira
   - Update the Jira ticket to reflect:
     - Merge commit hash
     - Deployed revision and timestamp
     - Post-merge review notes
     - Any follow-up tasks (e.g., hardening, additional tests)

3. Retrospective and root cause
   - If the emergency indicates a process or code deficiency, create follow-up stories to prevent recurrence.

Rollback Guidance
-----------------
- Define rollback criteria prior to merging.
- If rollback is required, follow the documented rollback steps in the PR and Jira issue.
- If a revert commit is used, link it back to the original Jira issue and document the reason in the PR comments.

Documentation & Audit Trail
---------------------------
- The PR must contain:
  - Jira key and link
  - Justification for emergency
  - CI artifacts or notes on smoke tests run
  - Approver identities (GitHub review metadata is sufficient)
  - Post-merge review notes
- If branch protection was bypassed, record:
  - Who performed the bypass
  - Reason for bypass
  - Time of bypass
  - Where the bypass is documented (PR comment + Jira ticket)
- Preserve all PR history (no force-push or deletion of the PR record).

Sole-contributor or Small-team Exceptions
-----------------------------------------
- If a service has a single active contributor and an emergency occurs, the tech lead must approve the PR as the second reviewer.
- Document this arrangement in the service README and in the PR.

Automation & Labels
-------------------
- Label emergency PRs with `emergency` or `hotfix`.
- Optionally add `needs-post-review` to track the post-merge obligation.
- Consider automating a reminder that pings the author and tech lead 12 hours after merge if the post-merge review is not complete.

Checklist (use this in the PR)
------------------------------
- [ ] Jira ticket created/referenced (GRADLOOP-###)
- [ ] Branch named `hotfix/GRADLOOP-<id>-short-desc`
- [ ] Minimal change implemented
- [ ] CI or smoke tests run and linked
- [ ] At least one approving reviewer plus tech lead (if needed)
- [ ] Merge performed and commit hash recorded in Jira
- [ ] Post-merge review completed within 24 hours
- [ ] Retrospective ticket(s) created (if applicable)

Contacts
--------
- Tech Lead(s): listed in repository README or team handbook
- Platform Admins: responsible for branch protection and incident support
- Security Contact: listed in security policy

Examples
--------
- Hotfix branch example: `hotfix/GRADLOOP-412-fix-bulk-upload-null-pointer`
- PR title example: `EMERGENCY: GRADLOOP-412 - Fix crash on bulk upload`
- Post-merge PR comment example: "Post-merge review completed by @alice and @bob. CI logs: <link>. No further issues observed."

Notes
-----
- Emergency merges should be rare. Use the emergency process only when the impact justifies expedited handling.
- After the emergency, discuss process improvements to avoid the same class of incident in future releases.

If you'd like, I can draft a one-file GitHub Action that helps label emergency PRs and enforce a `jira-link-check` for hotfix branches, or provide a sample `CODEOWNERS` snippet to auto-request tech lead reviewers for hotfix paths.