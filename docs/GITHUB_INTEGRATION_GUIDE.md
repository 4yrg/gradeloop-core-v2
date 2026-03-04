# GitHub Integration for Assignments

## Overview

The GitHub integration feature allows assignments to be connected to GitHub repositories, enabling students to submit code through version control. This provides a professional workflow and makes code review easier for instructors.

## Features

### For Instructors

1. **Repository Configuration**
   - Connect assignments to existing GitHub repositories
   - Set up template repositories for starter code
   - Configure submission requirements (commits vs pull requests)
   - Auto-create student forks or branches

2. **Submission Management**
   - Require pull requests for formal submissions
   - Review student code directly on GitHub
   - Track commit history and timestamps
   - Provide inline code comments and feedback

3. **Branch Management**
   - Define branch naming conventions
   - Set default branches for assignments
   - Configure protected branches

### For Students

1. **GitHub Workflow**
   - Clone assignment repository to IDE
   - Create personal branches for work
   - Commit and push changes
   - Create pull requests for submission

2. **Version Control**
   - Full git history of their work
   - Ability to revert changes
   - Collaborative features for group work
   - Professional portfolio building

## Setup Guide

### Instructor Setup

#### Step 1: Create Assignment Repository

```bash
# Option 1: Create a new repository on GitHub
# Go to github.com and create a new repository

# Option 2: Use GitHub CLI
gh repo create assignment-name --private --description "Assignment repository"
```

#### Step 2: Add Starter Code

```bash
# Clone the repository
git clone https://github.com/your-org/assignment-name.git
cd assignment-name

# Add starter code and README
echo "# Assignment: Your Assignment Title" > README.md
mkdir src
echo "# Your code here" > src/main.py

# Commit and push
git add .
git commit -m "Add starter code"
git push
```

#### Step 3: Configure in GradeLoop

1. Navigate to the assignment creation/edit page
2. Enable "GitHub Integration"
3. Enter repository details:
   - **Repository Owner**: Your GitHub username or organization
   - **Repository Name**: The repository name
   - **Default Branch**: `main` (or your preferred branch)
4. Configure submission settings:
   - ☑️ **Require Pull Request**: Students must create PRs to submit
   - ☑️ **Auto-create Repositories**: Automatically fork for each student
   - **Submission Branch Prefix**: `submission` (creates branches like `submission-john-doe`)
5. Test the connection
6. Save the assignment

### Student Setup

#### Step 1: Configure GitHub Token

Students need to create a Personal Access Token:

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Set permissions:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `read:user` (Read user profile data)
   - ✅ `user:email` (Access user email addresses)
4. Generate token and copy it
5. In GradeLoop IDE, paste token in GitHub panel
6. Click "Save Token"

#### Step 2: Clone Repository

1. Open the assignment in the IDE
2. In the GitHub panel, click "Clone"
3. Wait for files to load into the IDE
4. Start coding!

#### Step 3: Commit Changes

Regular commits help track progress:

1. Make changes to your code
2. Click "Commit" in GitHub panel
3. Enter a meaningful commit message:
   ```
   Add function to calculate average
   
   - Implemented calculate_average() function
   - Added error handling for empty lists
   - Updated tests
   ```
4. Click "Commit"

**Commit Message Tips:**
- Use present tense ("Add feature" not "Added feature")
- Keep first line under 50 characters
- Add detailed description in body if needed
- Reference issue numbers if applicable

#### Step 4: Create Pull Request (if required)

1. Ensure you're on your personal branch (e.g., `submission-yourname`)
2. Push all your commits
3. Click "Create PR" in GitHub panel
4. Enter PR details:
   - **Title**: "Assignment Submission - [Your Name]"
   - **Description**: Brief summary of your implementation
5. Click "Create Pull Request"
6. Copy the PR URL for submission

## Workflow Examples

### Example 1: Simple Commit-Based Submission

**Assignment**: Python programming assignment

**Student Workflow:**
```
1. Open assignment → GitHub panel shows "Clone" button
2. Click "Clone" → Files load into IDE
3. Edit src/solution.py
4. Click "Commit" → Enter "Implement bubble sort algorithm"
5. Continue working and committing
6. Final commit → "Complete assignment"
7. Submit via GradeLoop
```

### Example 2: Pull Request Submission

**Assignment**: Web development project

**Student Workflow:**
```
1. Clone repository to IDE
2. GitHub automatically creates branch: submission-alice
3. Make changes across multiple files
4. Commit changes regularly:
   - "Add HTML structure"
   - "Style with CSS"
   - "Add JavaScript interactivity"
5. Click "Create PR"
6. Fill in PR details with implementation notes
7. Submit PR URL as assignment submission
```

### Example 3: Group Assignment

**Assignment**: Software engineering project (groups of 3)

**Team Workflow:**
```
Team Leader:
1. Clone repository
2. Create branches for each team member
3. Assign tasks

Each Team Member:
1. Switch to their branch
2. Work on assigned features
3. Commit changes regularly
4. Push to their branch

Team Leader (Final):
1. Merge member branches
2. Test integrated code
3. Create final pull request
4. Submit PR URL
```

## Best Practices

### For Instructors

1. **Documentation**
   - Include clear README with requirements
   - Provide starter code structure
   - Add comments explaining expected implementation

2. **Testing**
   - Include test files students can run
   - Setup CI/CD for automatic testing
   - Provide test output format

3. **Security**
   - Use private repositories for assignments
   - Enable branch protection on main branch
   - Review permissions before grading

4. **Feedback**
   - Use GitHub's line-by-line commenting
   - Create issues for major problems
   - Use PR reviews for overall feedback

### For Students

1. **Commit Frequency**
   - Commit after each logical change
   - Don't wait until the end
   - Aim for 5-10 commits per assignment

2. **Commit Messages**
   - Be descriptive and specific
   - Explain WHY, not just WHAT
   - Use consistent format

3. **Code Organization**
   - Follow project structure
   - Keep files organized
   - Delete commented-out code before submission

4. **Testing**
   - Test your code before committing
   - Run provided tests
   - Add your own tests if appropriate

## Troubleshooting

### Common Issues

#### "Authentication Failed"
**Problem**: Invalid or expired GitHub token

**Solution**:
1. Generate a new token at github.com/settings/tokens
2. Ensure token has `repo` permissions
3. Update token in GitHub panel

#### "Repository Not Found"
**Problem**: Incorrect repository configuration

**Solution**:
1. Verify repository owner and name
2. Check if repository is private and you have access
3. Test connection in assignment settings

#### "Branch Already Exists"
**Problem**: Student branch was created previously

**Solution**:
1. Switch to existing branch instead
2. Or create a new branch with different name
3. Contact instructor if branch needs to be reset

#### "Push Rejected"
**Problem**: Branch is protected or lacks permissions

**Solution**:
1. Ensure you're not pushing to main branch
2. Push to your personal branch instead
3. Check repository permissions

### Getting Help

If you encounter issues:

1. **Check Documentation**: Review this guide
2. **Test Connection**: Use "Test Connection" button in settings
3. **Verify Permissions**: Ensure token has correct scopes
4. **Contact Support**: Reach out to your instructor or TA

## Security Considerations

### Token Security

⚠️ **Important**: GitHub tokens are sensitive credentials

**DO:**
- ✅ Store tokens securely in browser localStorage
- ✅ Use tokens with minimal required permissions
- ✅ Regenerate tokens periodically
- ✅ Revoke unused tokens

**DON'T:**
- ❌ Share your token with anyone
- ❌ Commit tokens to code
- ❌ Use tokens on shared computers without signing out
- ❌ Grant more permissions than needed

### Repository Access

**Instructors should:**
- Use private repositories for assignments
- Add students as collaborators or use organization
- Enable branch protection on main branch
- Review access logs periodically

**Students should:**
- Only access their assigned repository
- Work in designated branches
- Not modify starter code branches
- Report suspicious activity

## Advanced Features

### CI/CD Integration

Add automated testing with GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Test Student Code

on:
  push:
    branches: [ submission-* ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: pip install -r requirements.txt
      - name: Run tests
        run: pytest tests/
```

### Code Review Templates

Create PR templates for consistent submissions:

```markdown
# .github/pull_request_template.md
## Assignment Submission

**Student Name**: 
**Student ID**: 
**Date**: 

### Implementation Summary
<!-- Brief description of your solution -->

### Challenges Faced
<!-- Any difficulties and how you solved them -->

### Testing Done
<!-- Describe how you tested your code -->

### Additional Notes
<!-- Anything else the instructor should know -->

---
By submitting this PR, I confirm that this is my own work and I have not plagiarized.
```

### Webhook Integration

For automatic submission tracking, set up webhooks:

1. Go to repository settings → Webhooks
2. Add webhook URL: `https://your-gradeloop.com/api/github-webhook`
3. Select events: Pull requests, Pushes
4. Save webhook

## API Reference

### GitHub Service Methods

```typescript
// Initialize GitHub service
githubService.initialize(token: string, organization?: string)

// Repository operations
githubService.createAssignmentRepo(code: string, description?: string)
githubService.getRepository(owner: string, repo: string)
githubService.forkRepository(owner: string, repo: string)

// Branch operations
githubService.createBranch(owner, repo, branchName, fromBranch)
githubService.listBranches(owner, repo)

// File operations
githubService.getFileContent(owner, repo, path, branch?)
githubService.createOrUpdateFile(owner, repo, path, content, message, branch)
githubService.deleteFile(owner, repo, path, message, sha, branch)

// Commit operations
githubService.getCommits(owner, repo, branch?, limit?)
githubService.createCommitComment(owner, repo, sha, body)

// Pull request operations
githubService.createPullRequest(owner, repo, title, head, base, body?)
githubService.getPullRequests(owner, repo, state?)
```

### React Hooks

```typescript
// GitHub integration hook
const {
  repository,
  commits,
  currentBranch,
  isLoading,
  error,
  initializeGitHub,
  cloneRepository,
  commitChanges,
  createBranch,
  createPullRequest,
} = useGitHubIntegration(assignment);

// Generate student branch name
const branchName = useStudentBranchName(assignment, userId, username);

// Check if GitHub is available
const isAvailable = useGitHubAvailable(assignment);
```

## Future Enhancements

Planned features for future releases:

- [ ] GitHub Classroom integration
- [ ] Automated code review with AI
- [ ] Plagiarism detection via commit analysis
- [ ] Live collaboration features
- [ ] Integrated code review panel
- [ ] Batch operations for instructors
- [ ] Student progress dashboards
- [ ] Automated grading based on tests

## FAQs

**Q: Can I use my existing GitHub account?**
A: Yes! Just create a Personal Access Token and configure it in GradeLoop.

**Q: Will my commits be visible to other students?**
A: No, if using private repositories or personal branches.

**Q: Can I work offline?**
A: No, the web-based IDE requires internet connection for GitHub operations.

**Q: How many repositories can I connect?**
A: One repository per assignment, but unlimited assignments.

**Q: Can I submit multiple times?**
A: Yes! Each commit or PR version can be reviewed.

**Q: What happens if I forget to create a PR?**
A: Contact your instructor - they can review your commits directly.

**Q: Can groups work in the same repository?**
A: Yes, if properly configured with appropriate access.

**Q: Is my code backed up?**
A: Yes, all code committed to GitHub is stored there permanently.

## Support

For technical support:
- Email: support@gradeloop.edu
- Documentation: docs.gradeloop.edu
- GitHub Issues: github.com/gradeloop/support

---

*Last Updated: February 2026*
