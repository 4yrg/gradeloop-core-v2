// GitHub Integration Service for Assignments

interface GitHubConfig {
  token?: string;
  organization?: string;
  defaultBranch: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  private: boolean;
  created_at: string;
}

interface CreateRepoRequest {
  name: string;
  description?: string;
  private: boolean;
  auto_init?: boolean;
  gitignore_template?: string;
}

interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  html_url: string;
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

interface CreateFileRequest {
  message: string;
  content: string;
  branch?: string;
  committer?: {
    name: string;
    email: string;
  };
}

interface UpdateFileRequest extends CreateFileRequest {
  sha: string;
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

class GitHubService {
  private baseUrl = 'https://api.github.com';
  private token: string | null = null;
  private organization: string | null = null;

  /**
   * Initialize GitHub service with token
   */
  initialize(token: string, organization?: string) {
    this.token = token;
    this.organization = organization || null;
  }

  /**
   * Get headers for GitHub API requests
   */
  private getHeaders(): HeadersInit {
    if (!this.token) {
      throw new Error('GitHub token not configured');
    }

    return {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new repository for an assignment
   */
  async createAssignmentRepo(
    assignmentCode: string,
    description?: string,
    isPrivate: boolean = true,
  ): Promise<GitHubRepository> {
    const repoName = `assignment-${assignmentCode.toLowerCase()}`;
    
    const payload: CreateRepoRequest = {
      name: repoName,
      description: description || `Repository for assignment ${assignmentCode}`,
      private: isPrivate,
      auto_init: true,
      gitignore_template: 'Python', // Can be made configurable
    };

    const endpoint = this.organization 
      ? `${this.baseUrl}/orgs/${this.organization}/repos`
      : `${this.baseUrl}/user/repos`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create repository: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Fork a repository for a student
   */
  async forkRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/forks`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fork repository: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Get repository details
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error('Repository not found');
    }

    return response.json();
  }

  /**
   * Create a new branch
   */
  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromBranch: string = 'main',
  ): Promise<GitHubBranch> {
    // Get the SHA of the from branch
    const refResponse = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
    );

    if (!refResponse.ok) {
      throw new Error('Failed to get source branch');
    }

    const refData = await refResponse.json();
    const sha = refData.object.sha;

    // Create new branch
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: sha,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create branch: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Get file content from repository
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    branch?: string,
  ): Promise<GitHubFile> {
    const url = new URL(`${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`);
    if (branch) {
      url.searchParams.set('ref', branch);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('File not found');
    }

    const data = await response.json();
    
    // Decode base64 content if it exists
    if (data.content && data.encoding === 'base64') {
      data.content = atob(data.content);
    }

    return data;
  }

  /**
   * Create or update a file in repository
   */
  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch: string = 'main',
    sha?: string,
  ): Promise<any> {
    const encodedContent = btoa(content);

    const payload: any = {
      message,
      content: encodedContent,
      branch,
    };

    if (sha) {
      payload.sha = sha;
    }

    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create/update file: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Get commits for a repository
   */
  async getCommits(
    owner: string,
    repo: string,
    branch?: string,
    limit: number = 10,
  ): Promise<GitHubCommit[]> {
    const url = new URL(`${this.baseUrl}/repos/${owner}/${repo}/commits`);
    if (branch) {
      url.searchParams.set('sha', branch);
    }
    url.searchParams.set('per_page', limit.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch commits');
    }

    return response.json();
  }

  /**
   * Create a pull request
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
  ): Promise<GitHubPullRequest> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          title,
          head,
          base,
          body,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create pull request: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Get pull requests for a repository
   */
  async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'all',
  ): Promise<GitHubPullRequest[]> {
    const url = new URL(`${this.baseUrl}/repos/${owner}/${repo}/pulls`);
    url.searchParams.set('state', state);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch pull requests');
    }

    return response.json();
  }

  /**
   * List repository contents (files and directories)
   */
  async listContents(
    owner: string,
    repo: string,
    path: string = '',
    branch?: string,
  ): Promise<GitHubFile[]> {
    const url = new URL(`${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`);
    if (branch) {
      url.searchParams.set('ref', branch);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to list contents');
    }

    return response.json();
  }

  /**
   * Clone repository (get all files recursively)
   */
  async cloneRepositoryFiles(
    owner: string,
    repo: string,
    branch?: string,
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();

    const processDirectory = async (path: string = ''): Promise<void> => {
      const contents = await this.listContents(owner, repo, path, branch);

      for (const item of contents) {
        if (item.type === 'file') {
          const fileContent = await this.getFileContent(owner, repo, item.path, branch);
          if (fileContent.content) {
            files.set(item.path, fileContent.content);
          }
        } else if (item.type === 'dir') {
          await processDirectory(item.path);
        }
      }
    };

    await processDirectory();
    return files;
  }

  /**
   * Delete a file from repository
   */
  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch: string = 'main',
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message,
          sha,
          branch,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete file: ${error.message}`);
    }

    return response.json();
  }

  /**
   * Check if user has access to repository
   */
  async checkAccess(owner: string, repo: string): Promise<boolean> {
    try {
      await this.getRepository(owner, repo);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a commit comment
   */
  async createCommitComment(
    owner: string,
    repo: string,
    commitSha: string,
    body: string,
    path?: string,
    position?: number,
  ): Promise<any> {
    const payload: any = { body };
    if (path) payload.path = path;
    if (position !== undefined) payload.position = position;

    const response = await fetch(
      `${this.baseUrl}/repos/${owner}/${repo}/commits/${commitSha}/comments`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create comment: ${error.message}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const githubService = new GitHubService();

// Export types
export type {
  GitHubConfig,
  GitHubRepository,
  CreateRepoRequest,
  GitHubCommit,
  GitHubBranch,
  GitHubFile,
  CreateFileRequest,
  UpdateFileRequest,
  GitHubPullRequest,
};
