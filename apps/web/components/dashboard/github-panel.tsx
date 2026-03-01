"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Github,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Upload,
  Download,
  RefreshCw,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  Plus,
} from "lucide-react";
import { useGitHubIntegration, useStudentBranchName } from "@/lib/hooks/use-github-integration";
import type { Assignment } from "@/types/assessment.types";
import { useAuthStore } from "@/lib/stores/authStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface GitHubPanelProps {
  assignment: Assignment;
  onFilesLoaded?: (files: Map<string, string>) => void;
  currentFiles?: Array<{ path: string; content: string }>;
}

export function GitHubPanel({ assignment, onFilesLoaded, currentFiles = [] }: GitHubPanelProps) {
  const { user } = useAuthStore();
  const studentBranch = useStudentBranchName(assignment, user?.id || '', user?.name);

  const {
    repository,
    commits,
    currentBranch,
    isLoading,
    error,
    isInitialized,
    initializeGitHub,
    cloneRepository,
    commitChanges,
    createBranch,
    switchBranch,
    createPullRequest,
    refreshCommits,
  } = useGitHubIntegration(assignment);

  const [githubToken, setGithubToken] = React.useState('');
  const [commitMessage, setCommitMessage] = React.useState('');
  const [prTitle, setPrTitle] = React.useState('');
  const [prBody, setPrBody] = React.useState('');
  const [showCommitDialog, setShowCommitDialog] = React.useState(false);
  const [showPRDialog, setShowPRDialog] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Initialize GitHub if token is available
  React.useEffect(() => {
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) {
      setGithubToken(savedToken);
      initializeGitHub(savedToken, assignment.github_integration?.repository_owner);
    }
  }, [assignment, initializeGitHub]);

  const handleSaveToken = () => {
    if (!githubToken.trim()) {
      setLocalError('Please enter a valid GitHub token');
      return;
    }

    localStorage.setItem('github_token', githubToken);
    initializeGitHub(githubToken, assignment.github_integration?.repository_owner);
    setLocalError(null);
    setSuccessMessage('GitHub token saved successfully');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleClone = async () => {
    setLocalError(null);
    try {
      const files = await cloneRepository();
      onFilesLoaded?.(files);
      setSuccessMessage('Repository cloned successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      setLocalError(error.message);
    }
  };

  const handleCreateBranch = async () => {
    setLocalError(null);
    try {
      await createBranch(studentBranch);
      setSuccessMessage(`Branch ${studentBranch} created successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      setLocalError(error.message);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setLocalError('Please enter a commit message');
      return;
    }

    setLocalError(null);
    try {
      await commitChanges(currentFiles, commitMessage);
      setCommitMessage('');
      setShowCommitDialog(false);
      setSuccessMessage('Changes committed successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      setLocalError(error.message);
    }
  };

  const handleCreatePR = async () => {
    if (!prTitle.trim()) {
      setLocalError('Please enter a pull request title');
      return;
    }

    setLocalError(null);
    try {
      const prUrl = await createPullRequest(prTitle, prBody);
      setPrTitle('');
      setPrBody('');
      setShowPRDialog(false);
      setSuccessMessage(
        <span>
          Pull request created:{' '}
          <a href={prUrl} target="_blank" rel="noopener noreferrer" className="underline">
            View PR
          </a>
        </span>
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error: any) {
      setLocalError(error.message);
    }
  };

  if (!assignment.github_integration?.enabled) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <Github className="h-4 w-4" />
            <AlertTitle>GitHub Integration Not Enabled</AlertTitle>
            <AlertDescription>
              This assignment does not have GitHub integration configured.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* GitHub Token Configuration */}
      {!isInitialized && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub Authentication
            </CardTitle>
            <CardDescription>
              Enter your GitHub Personal Access Token to access the repository
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="github-token">Personal Access Token</Label>
              <Input
                id="github-token"
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
              />
              <p className="text-xs text-zinc-500">
                Create a token with <code>repo</code> permissions at{' '}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  github.com/settings/tokens
                </a>
              </p>
            </div>
            <Button onClick={handleSaveToken} className="w-full">
              Save Token
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {(error || localError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || localError}</AlertDescription>
        </Alert>
      )}

      {/* Repository Info */}
      {isInitialized && repository && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                {repository.name}
              </CardTitle>
              <Badge variant="outline">
                {repository.private ? 'Private' : 'Public'}
              </Badge>
            </div>
            <CardDescription>
              <a
                href={repository.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline"
              >
                {repository.full_name}
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Branch */}
            <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium">{currentBranch}</span>
              </div>
              {currentBranch !== studentBranch && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateBranch}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create My Branch
                </Button>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={handleClone}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Clone
              </Button>

              <Dialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={isLoading || currentFiles.length === 0}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Commit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Commit Changes</DialogTitle>
                    <DialogDescription>
                      Commit {currentFiles.length} file(s) to {currentBranch}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="commit-message">Commit Message</Label>
                      <Textarea
                        id="commit-message"
                        placeholder="Update assignment files"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowCommitDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCommit} disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <GitCommit className="h-4 w-4 mr-2" />
                      )}
                      Commit
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                onClick={refreshCommits}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {assignment.github_integration?.require_pull_request && (
                <Dialog open={showPRDialog} onOpenChange={setShowPRDialog}>
                  <DialogTrigger asChild>
                    <Button disabled={isLoading || currentBranch === repository.default_branch}>
                      <GitPullRequest className="h-4 w-4 mr-2" />
                      Create PR
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Pull Request</DialogTitle>
                      <DialogDescription>
                        Submit your work by creating a pull request
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="pr-title">Title</Label>
                        <Input
                          id="pr-title"
                          placeholder="Assignment Submission"
                          value={prTitle}
                          onChange={(e) => setPrTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pr-body">Description (Optional)</Label>
                        <Textarea
                          id="pr-body"
                          placeholder="Describe your changes..."
                          value={prBody}
                          onChange={(e) => setPrBody(e.target.value)}
                          rows={4}
                        />
                      </div>
                      <div className="text-sm text-zinc-500">
                        <p>From: {currentBranch}</p>
                        <p>To: {repository.default_branch}</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowPRDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreatePR} disabled={isLoading}>
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <GitPullRequest className="h-4 w-4 mr-2" />
                        )}
                        Create Pull Request
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Commits */}
      {isInitialized && commits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCommit className="h-5 w-5" />
              Recent Commits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commits.slice(0, 5).map((commit) => (
                <div
                  key={commit.sha}
                  className="flex items-start gap-3 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg"
                >
                  <GitCommit className="h-4 w-4 text-zinc-500 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{commit.message}</p>
                    <p className="text-xs text-zinc-500">
                      {commit.author.name} • {format(new Date(commit.author.date), 'MMM dd, h:mm a')}
                    </p>
                  </div>
                  <a
                    href={commit.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
