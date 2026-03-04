"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Github, 
  GitBranch, 
  Lock, 
  Unlock, 
  Check, 
  AlertCircle,
  ExternalLink,
  Info,
} from "lucide-react";
import type { GitHubIntegration } from "@/types/assessment.types";

interface GitHubConfigurationProps {
  config: GitHubIntegration;
  onChange: (config: GitHubIntegration) => void;
  disabled?: boolean;
}

export function GitHubConfiguration({ config, onChange, disabled = false }: GitHubConfigurationProps) {
  const [testingConnection, setTestingConnection] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

  const handleToggle = (field: keyof GitHubIntegration) => {
    onChange({
      ...config,
      [field]: !config[field],
    });
  };

  const handleChange = (field: keyof GitHubIntegration, value: any) => {
    onChange({
      ...config,
      [field]: value,
    });
  };

  const testConnection = async () => {
    if (!config.repository_owner || !config.repository_name) {
      setConnectionStatus('error');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      // Simulate API call to test GitHub connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In real implementation, this would call GitHub API
      setConnectionStatus('success');
    } catch (error) {
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enable GitHub Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                GitHub Integration
              </CardTitle>
              <CardDescription>
                Connect this assignment to a GitHub repository for version control
              </CardDescription>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={() => handleToggle('enabled')}
              disabled={disabled}
            />
          </div>
        </CardHeader>

        {config.enabled && (
          <CardContent className="space-y-6">
            {/* Info Alert */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>GitHub Token Required</AlertTitle>
              <AlertDescription>
                Students will need to configure their GitHub personal access token in their profile settings
                to use this feature. Make sure to instruct them on creating a token with appropriate permissions:
                <code className="block mt-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-sm">
                  repo, read:user, user:email
                </code>
              </AlertDescription>
            </Alert>

            <Separator />

            {/* Repository Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Repository Settings</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="repo-owner">Repository Owner/Organization *</Label>
                  <Input
                    id="repo-owner"
                    placeholder="username or org-name"
                    value={config.repository_owner || ''}
                    onChange={(e) => handleChange('repository_owner', e.target.value)}
                    disabled={disabled}
                  />
                  <p className="text-xs text-zinc-500">
                    The GitHub username or organization that owns the repository
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repo-name">Repository Name *</Label>
                  <Input
                    id="repo-name"
                    placeholder="assignment-repo"
                    value={config.repository_name || ''}
                    onChange={(e) => handleChange('repository_name', e.target.value)}
                    disabled={disabled}
                  />
                  <p className="text-xs text-zinc-500">
                    The name of the GitHub repository
                  </p>
                </div>
              </div>

              {/* Full URL Display */}
              {config.repository_owner && config.repository_name && (
                <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <Github className="h-4 w-4 text-zinc-500" />
                  <span className="text-sm font-mono">
                    https://github.com/{config.repository_owner}/{config.repository_name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a
                      href={`https://github.com/${config.repository_owner}/${config.repository_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}

              {/* Test Connection */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={testingConnection || !config.repository_owner || !config.repository_name || disabled}
                >
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </Button>

                {connectionStatus === 'success' && (
                  <Badge variant="outline" className="text-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                )}

                {connectionStatus === 'error' && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Connection Failed
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Branch Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Branch Settings
              </h3>

              <div className="space-y-2">
                <Label htmlFor="default-branch">Default Branch</Label>
                <Input
                  id="default-branch"
                  placeholder="main"
                  value={config.default_branch || 'main'}
                  onChange={(e) => handleChange('default_branch', e.target.value)}
                  disabled={disabled}
                />
                <p className="text-xs text-zinc-500">
                  The main branch that students will fork from
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch-prefix">Submission Branch Prefix</Label>
                <Input
                  id="branch-prefix"
                  placeholder="submission"
                  value={config.submission_branch_prefix || ''}
                  onChange={(e) => handleChange('submission_branch_prefix', e.target.value)}
                  disabled={disabled}
                />
                <p className="text-xs text-zinc-500">
                  Each student will create a branch named: prefix-student-username
                </p>
              </div>
            </div>

            <Separator />

            {/* Submission Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Submission Settings</h3>

              <div className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="require-pr">Require Pull Request</Label>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Students must create a pull request to submit
                  </p>
                </div>
                <Switch
                  id="require-pr"
                  checked={config.require_pull_request}
                  onCheckedChange={() => handleToggle('require_pull_request')}
                  disabled={disabled}
                />
              </div>

              <div className="flex items-center justify-between p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-create">Auto-create Student Repositories</Label>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Automatically create forks for each student
                  </p>
                </div>
                <Switch
                  id="auto-create"
                  checked={config.auto_create_repos}
                  onCheckedChange={() => handleToggle('auto_create_repos')}
                  disabled={disabled}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-repo">Template Repository (Optional)</Label>
                <Input
                  id="template-repo"
                  placeholder="owner/template-repo"
                  value={config.template_repo || ''}
                  onChange={(e) => handleChange('template_repo', e.target.value)}
                  disabled={disabled}
                />
                <p className="text-xs text-zinc-500">
                  Use a template repository to initialize student repositories
                </p>
              </div>
            </div>

            {/* Warning for Students */}
            {config.require_pull_request && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription>
                  With Pull Request submission enabled, students must:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Create a new branch with their username</li>
                    <li>Push their changes to that branch</li>
                    <li>Create a pull request to the default branch</li>
                    <li>Submit the pull request URL as their submission</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}
      </Card>

      {/* Repository URL Display (when disabled for clarity) */}
      {config.enabled && config.repository_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Repository URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {config.repository_url.includes('private') ? (
                <Lock className="h-4 w-4 text-yellow-600" />
              ) : (
                <Unlock className="h-4 w-4 text-green-600" />
              )}
              <code className="text-sm font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                {config.repository_url}
              </code>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
