/**
 * GitHub Service - Read-Only Access
 *
 * Provides read-only access to configured GitHub repositories.
 * Repositories are configured via the GITHUB_REPOS environment variable.
 * NO write operations allowed.
 */

import { Octokit } from '@octokit/rest';
import { getGithubRepos, type RepoConfig } from '../config/app.js';

/**
 * Get configured repositories
 * Loaded from GITHUB_REPOS environment variable
 */
function getRepos(): RepoConfig[] {
  const repos = getGithubRepos();
  if (repos.length === 0) {
    console.warn(
      '[github] No repositories configured. Set GITHUB_REPOS in .env or run `npm run setup`.'
    );
  }
  return repos;
}

let octokit: Octokit | null = null;

function getClient(): Octokit {
  if (!octokit) {
    const token = process.env.GITHUB_TOKEN;
    console.error(`[github] GITHUB_TOKEN: ${token ? `set (${token.length} chars)` : 'NOT SET'}`);
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable not set');
    }
    octokit = new Octokit({ auth: token });
  }
  return octokit;
}

function findRepo(name: string): RepoConfig {
  const repos = getRepos();
  const lower = name.toLowerCase();
  const repo = repos.find(
    (r) => r.repo.toLowerCase() === lower || `${r.owner}/${r.repo}`.toLowerCase() === lower
  );
  if (!repo) {
    const available = repos.length > 0 ? repos.map((r) => r.repo).join(', ') : 'none configured';
    throw new Error(`Unknown repository: ${name}. Available: ${available}`);
  }
  return repo;
}

/**
 * List configured repositories
 */
export function listRepos(): RepoConfig[] {
  return getRepos();
}

/**
 * Search code across repositories
 */
export async function searchCode(
  query: string,
  options?: { repo?: string; limit?: number }
): Promise<{
  total: number;
  items: Array<{
    repo: string;
    path: string;
    url: string;
    snippet?: string;
  }>;
}> {
  const client = getClient();
  const limit = options?.limit ?? 20;

  // Build query with repo scope
  let fullQuery = query;
  if (options?.repo) {
    const repoConfig = findRepo(options.repo);
    fullQuery = `${query} repo:${repoConfig.owner}/${repoConfig.repo}`;
  } else {
    // Search all configured repos
    const repos = getRepos();
    if (repos.length === 0) {
      throw new Error(
        'No repositories configured. Set GITHUB_REPOS in .env or run `npm run setup`.'
      );
    }
    const repoQueries = repos.map((r) => `repo:${r.owner}/${r.repo}`).join(' ');
    fullQuery = `${query} (${repoQueries})`;
  }

  const response = await client.search.code({
    q: fullQuery,
    per_page: Math.min(limit, 100),
  });

  return {
    total: response.data.total_count,
    items: response.data.items.map((item) => ({
      repo: item.repository.full_name,
      path: item.path,
      url: item.html_url,
      snippet: item.text_matches?.[0]?.fragment,
    })),
  };
}

/**
 * Get file contents
 */
export async function getFile(
  repo: string,
  path: string,
  options?: { ref?: string }
): Promise<{
  path: string;
  content: string;
  size: number;
  sha: string;
  url: string;
}> {
  const client = getClient();
  const repoConfig = findRepo(repo);

  const response = await client.repos.getContent({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    path,
    ref: options?.ref,
  });

  const data = response.data;

  if (Array.isArray(data)) {
    throw new Error(`Path is a directory: ${path}. Use list_files instead.`);
  }

  if (data.type !== 'file') {
    throw new Error(`Path is not a file: ${path} (type: ${data.type})`);
  }

  // Decode base64 content
  const content = Buffer.from(data.content, 'base64').toString('utf-8');

  return {
    path: data.path,
    content,
    size: data.size,
    sha: data.sha,
    url: data.html_url ?? '',
  };
}

/**
 * List files in a directory
 */
export async function listFiles(
  repo: string,
  path?: string,
  options?: { ref?: string }
): Promise<
  Array<{
    name: string;
    path: string;
    type: 'file' | 'dir' | 'submodule' | 'symlink';
    size?: number;
  }>
> {
  const client = getClient();
  const repoConfig = findRepo(repo);

  const response = await client.repos.getContent({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    path: path ?? '',
    ref: options?.ref,
  });

  const data = response.data;

  if (!Array.isArray(data)) {
    throw new Error(`Path is a file: ${path}. Use get_file instead.`);
  }

  return data.map((item) => ({
    name: item.name,
    path: item.path,
    type: item.type as 'file' | 'dir' | 'submodule' | 'symlink',
    size: item.size,
  }));
}

/**
 * List recent commits
 */
export async function listCommits(
  repo: string,
  options?: { branch?: string; path?: string; limit?: number }
): Promise<
  Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  }>
> {
  const client = getClient();
  const repoConfig = findRepo(repo);

  const response = await client.repos.listCommits({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    sha: options?.branch,
    path: options?.path,
    per_page: options?.limit ?? 20,
  });

  return response.data.map((commit) => ({
    sha: commit.sha.substring(0, 7),
    message: commit.commit.message.split('\n')[0],
    author: commit.commit.author?.name ?? 'Unknown',
    date: commit.commit.author?.date ?? '',
    url: commit.html_url,
  }));
}

/**
 * List pull requests
 */
export async function listPullRequests(
  repo: string,
  options?: { state?: 'open' | 'closed' | 'all'; limit?: number }
): Promise<
  Array<{
    number: number;
    title: string;
    state: string;
    author: string;
    createdAt: string;
    url: string;
  }>
> {
  const client = getClient();
  const repoConfig = findRepo(repo);

  const response = await client.pulls.list({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    state: options?.state ?? 'open',
    per_page: options?.limit ?? 20,
  });

  return response.data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    author: pr.user?.login ?? 'Unknown',
    createdAt: pr.created_at,
    url: pr.html_url,
  }));
}

/**
 * Get pull request details
 */
export async function getPullRequest(
  repo: string,
  prNumber: number
): Promise<{
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
  branch: string;
  baseBranch: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  files: Array<{ filename: string; status: string; additions: number; deletions: number }>;
}> {
  const client = getClient();
  const repoConfig = findRepo(repo);

  const [prResponse, filesResponse] = await Promise.all([
    client.pulls.get({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      pull_number: prNumber,
    }),
    client.pulls.listFiles({
      owner: repoConfig.owner,
      repo: repoConfig.repo,
      pull_number: prNumber,
      per_page: 100,
    }),
  ]);

  const pr = prResponse.data;

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    state: pr.state,
    author: pr.user?.login ?? 'Unknown',
    branch: pr.head.ref,
    baseBranch: pr.base.ref,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    url: pr.html_url,
    files: filesResponse.data.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
    })),
  };
}

/**
 * Get repository info
 */
export async function getRepoInfo(repo: string): Promise<{
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  language: string;
  stars: number;
  forks: number;
  openIssues: number;
  url: string;
}> {
  const client = getClient();
  const repoConfig = findRepo(repo);

  const response = await client.repos.get({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
  });

  const data = response.data;

  return {
    name: data.name,
    fullName: data.full_name,
    description: data.description ?? '',
    defaultBranch: data.default_branch,
    language: data.language ?? 'Unknown',
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    url: data.html_url,
  };
}

/**
 * List branches
 */
export async function listBranches(
  repo: string,
  options?: { limit?: number }
): Promise<Array<{ name: string; sha: string; protected: boolean }>> {
  const client = getClient();
  const repoConfig = findRepo(repo);

  const response = await client.repos.listBranches({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    per_page: options?.limit ?? 30,
  });

  return response.data.map((branch) => ({
    name: branch.name,
    sha: branch.commit.sha.substring(0, 7),
    protected: branch.protected,
  }));
}
