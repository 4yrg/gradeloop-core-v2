# GitHub Integration - Quick Start

## Overview

GitHub integration allows assignments to be connected to GitHub repositories, enabling version control workflows for student submissions.

## Key Features

✅ **Repository Management** - Connect assignments to GitHub repos  
✅ **Branch Workflows** - Students work on personal branches  
✅ **Commit Tracking** - Full git history for each student  
✅ **Pull Request Submissions** - Optional PR-based grading  
✅ **Code Review** - Use GitHub's review tools  
✅ **Collaboration** - Support for group assignments  

## Quick Setup (5 minutes)

### For Instructors

1. **Create a GitHub repository** for your assignment
2. **Add starter code** to the repository
3. **In GradeLoop**, edit your assignment
4. **Enable GitHub Integration** section
5. **Enter repository details**:
   - Owner: `your-github-username`
   - Repository: `assignment-name`
   - Default Branch: `main`
6. **Choose submission method**:
   - ☑️ Require Pull Request (recommended)
   - ☐ Direct commits (simpler)
7. **Save** the assignment

### For Students

1. **Create GitHub Personal Access Token**:
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scopes: `repo`, `read:user`, `user:email`
   - Copy the token

2. **In GradeLoop IDE**:
   - Open the assignment
   - Paste token in GitHub panel
   - Click "Clone" to load files
   - Start coding!

3. **Submit your work**:
   - Click "Commit" to save changes
   - Add commit message
   - (If required) Click "Create PR"
   - Submit assignment

## File Structure

```
lib/api/
  └── github.service.ts          # GitHub API client

lib/hooks/
  └── use-github-integration.ts  # React hooks for GitHub

components/dashboard/
  ├── github-configuration.tsx   # Setup UI for instructors
  └── github-panel.tsx           # IDE panel for students

types/
  └── assessment.types.ts        # Updated with GitHub fields

docs/
  └── GITHUB_INTEGRATION_GUIDE.md  # Full documentation
```

## Components

### GitHubConfiguration

Instructor component for assignment setup:

```tsx
import { GitHubConfiguration } from '@/components/dashboard/github-configuration';

const [config, setConfig] = useState<GitHubIntegration>({
  enabled: false,
  repository_owner: '',
  repository_name: '',
  require_pull_request: false,
  auto_create_repos: false,
});

<GitHubConfiguration 
  config={config}
  onChange={setConfig}
/>
```

### GitHubPanel

Student component for IDE integration:

```tsx
import { GitHubPanel } from '@/components/dashboard/github-panel';

<GitHubPanel 
  assignment={assignment}
  onFilesLoaded={(files) => {
    // Load files into editor
    files.forEach((content, path) => {
      addFileToEditor(path, content);
    });
  }}
  currentFiles={[
    { path: 'src/main.py', content: editorContent }
  ]}
/>
```

## Usage Example

### Simple Workflow

```typescript
// 1. Initialize GitHub
const { 
  cloneRepository, 
  commitChanges, 
  createPullRequest 
} = useGitHubIntegration(assignment);

// 2. Clone repository
const files = await cloneRepository();

// 3. Make changes (in editor)
// ... student codes ...

// 4. Commit changes
await commitChanges([
  { path: 'solution.py', content: code }
], 'Add solution');

// 5. Create PR (if required)
const prUrl = await createPullRequest(
  'Assignment Submission',
  'Completed all requirements'
);
```

## Configuration Options

### GitHubIntegration Type

```typescript
interface GitHubIntegration {
  enabled: boolean;                  // Enable GitHub integration
  repository_url?: string;           // Full GitHub URL
  repository_name?: string;          // Repo name
  repository_owner?: string;         // Owner username/org
  default_branch?: string;           // Main branch (usually 'main')
  template_repo?: string;            // Template for new repos
  require_pull_request: boolean;     // Students must create PRs
  auto_create_repos: boolean;        // Auto-fork for students
  submission_branch_prefix?: string; // Branch naming (e.g., 'submission')
}
```

## API Methods

The `githubService` provides these methods:

```typescript
// Repository
createAssignmentRepo(code, description)
getRepository(owner, repo)
forkRepository(owner, repo)

// Branches
createBranch(owner, repo, branchName, fromBranch)
switchBranch(branchName)

// Files
getFileContent(owner, repo, path, branch?)
createOrUpdateFile(owner, repo, path, content, message, branch)
cloneRepositoryFiles(owner, repo, branch?)

// Commits
getCommits(owner, repo, branch?, limit?)
commitChanges(files[], message)

// Pull Requests
createPullRequest(owner, repo, title, head, base, body?)
getPullRequests(owner, repo, state?)
```

## Hooks

### useGitHubIntegration

Main hook for GitHub operations:

```typescript
const {
  repository,         // Repository info
  commits,           // Commit history
  currentBranch,     // Active branch
  isLoading,         // Loading state
  error,             // Error message
  isInitialized,     // Token configured?
  
  // Methods
  initializeGitHub,
  cloneRepository,
  commitChanges,
  createBranch,
  createPullRequest,
  refreshCommits,
} = useGitHubIntegration(assignment);
```

### Helper Hooks

```typescript
// Generate student branch name
const branch = useStudentBranchName(assignment, userId, username);
// Returns: "submission-john-doe"

// Check if GitHub available
const hasGitHub = useGitHubAvailable(assignment);
// Returns: true if configured
```

## Security

### Token Storage
- Tokens stored in browser `localStorage`
- Never sent to GradeLoop backend
- Used only for GitHub API calls
- Students can clear/regenerate anytime

### Permissions Required
- `repo` - Access private repositories
- `read:user` - Read user profile
- `user:email` - Access email addresses

### Best Practices
- Use private repositories
- Enable branch protection
- Review access logs
- Regenerate tokens periodically

## Troubleshooting

### "Authentication Failed"
→ Token expired or invalid. Generate a new one.

### "Repository Not Found"
→ Check owner and repository name. Verify access permissions.

### "Push Rejected"
→ Ensure you're pushing to your branch, not main.

### "Branch Already Exists"
→ Switch to existing branch or create one with different name.

## Examples

### Example 1: Python Assignment

**Instructor Setup:**
```
Repository: cs101/python-sorting
Branch: main
Requires PR: Yes
Prefix: submission
```

**Student Workflow:**
1. Clone repository
2. Create branch: `submission-alice`
3. Edit `sorting.py`
4. Commit: "Implement bubble sort"
5. Create PR: "Assignment Submission"
6. Submit PR URL

### Example 2: Web Development

**Instructor Setup:**
```
Repository: webdev/html-css-project
Branch: main  
Requires PR: No
Prefix: student
```

**Student Workflow:**
1. Clone repository
2. Work on main or create branch
3. Edit HTML/CSS files
4. Commit changes multiple times
5. Final commit triggers submission

### Example 3: Group Project

**Instructor Setup:**
```
Repository: cs201/group-project
Branch: main
Requires PR: Yes
Auto-create: Yes
```

**Team Workflow:**
1. Each member clones repository
2. Create feature branches
3. Commit to their branches
4. Team leader merges branches
5. Create final PR for grading

## Full Documentation

For complete details, see:
- [GitHub Integration Guide](docs/GITHUB_INTEGRATION_GUIDE.md)
- [Implementation Summary](GITHUB_INTEGRATION_IMPLEMENTATION.md)

## Support

Questions? Contact:
- Technical Support: support@gradeloop.edu
- Documentation: docs.gradeloop.edu
- Issues: Create a ticket in GradeLoop

---

**Last Updated**: February 2026  
**Version**: 1.0.0
