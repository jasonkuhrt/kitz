import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Effect } from 'effect'
import type { RuntimeConfig } from '../executor/runtime.js'
import { ExplorerError } from './errors.js'
import type { CiContext, GitIdentity, Recon } from './models/__.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Detect the PR number from environment variables.
 *
 * Checks (in order): `GITHUB_PR_NUMBER`, `PR_NUMBER`, `CI_PULL_REQUEST` (URL form).
 * Returns `null` if no PR number can be determined.
 */
export const detectPrNumber = (vars: Record<string, string | undefined>): number | null => {
  if (vars['GITHUB_PR_NUMBER']) {
    const num = parseInt(vars['GITHUB_PR_NUMBER'], 10)
    if (!isNaN(num)) return num
  }
  if (vars['PR_NUMBER']) {
    const num = parseInt(vars['PR_NUMBER'], 10)
    if (!isNaN(num)) return num
  }
  if (vars['CI_PULL_REQUEST']) {
    const match = vars['CI_PULL_REQUEST'].match(/\/pull\/(\d+)/)
    if (match) {
      const num = parseInt(match[1]!, 10)
      if (!isNaN(num)) return num
    }
  }
  return null
}

/** Detect CI provider and PR context from environment variables. */
const detectExecutionContext = (vars: Record<string, string | undefined>): CiContext => {
  const prNumber = detectPrNumber(vars)
  if (vars['GITHUB_ACTIONS'] === 'true') {
    return { detected: true, provider: 'github-actions', prNumber }
  }
  if (vars['CI'] === 'true') {
    return { detected: true, provider: 'generic', prNumber }
  }
  return { detected: false, provider: null, prNumber }
}

const detectPrTitle = (vars: Record<string, string | undefined>): string | null => {
  const title = vars['GITHUB_PR_TITLE'] ?? vars['PR_TITLE']
  if (!title || title.trim() === '') return null
  return title.trim()
}

const detectPrBody = (vars: Record<string, string | undefined>): string =>
  vars['GITHUB_PR_BODY'] ?? vars['PR_BODY'] ?? ''

/** Parse `GITHUB_REPOSITORY` env var format (`"owner/repo"`) into components. */
const parseGitHubRepository = (value: string): { owner: string; repo: string } | null => {
  const trimmed = value.trim()
  const parts = trimmed.split('/')
  if (parts.length !== 2) return null
  const owner = parts[0]
  const repo = parts[1]
  if (!owner || !repo) return null
  return { owner, repo }
}

/** Parse a GitHub remote URL (HTTPS or SSH) into owner/repo components. */
const parseGitHubRemote = (url: string): { owner: string; repo: string } | null => {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) return null
  return { owner: match[1]!, repo: match[2]! }
}

export const resolveReleaseTarget = (
  vars: Record<string, string | undefined>,
): Effect.Effect<GitIdentity, ExplorerError, Git.Git> =>
  Effect.gen(function* () {
    const repository = vars['GITHUB_REPOSITORY']
    if (repository !== undefined) {
      const parsed = parseGitHubRepository(repository)
      if (!parsed) {
        return yield* Effect.fail(
          new ExplorerError({
            context: {
              detail: `Invalid GITHUB_REPOSITORY format "${repository}". Expected "<owner>/<repo>".`,
            },
          }),
        )
      }
      return {
        owner: parsed.owner,
        repo: parsed.repo,
        source: 'env:GITHUB_REPOSITORY',
      } satisfies GitIdentity
    }

    const git = yield* Git.Git
    const remoteUrl = yield* git.getRemoteUrl('origin').pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new ExplorerError({
            context: {
              detail: `Could not read git remote "origin". Set GITHUB_REPOSITORY="<owner>/<repo>" or configure origin to github.com. (${error.message})`,
            },
          }),
        ),
      ),
    )

    const parsedRemote = parseGitHubRemote(remoteUrl)
    if (!parsedRemote) {
      return yield* Effect.fail(
        new ExplorerError({
          context: {
            detail: `Could not resolve GitHub repository from origin remote "${remoteUrl}". Set GITHUB_REPOSITORY="<owner>/<repo>" or configure origin to github.com.`,
          },
        }),
      )
    }

    return {
      owner: parsedRemote.owner,
      repo: parsedRemote.repo,
      source: 'git:origin',
    } satisfies GitIdentity
  })

/** Extract a non-empty GitHub token from environment variables. */
const resolveGithubToken = (vars: Record<string, string | undefined>): string | null => {
  const token = vars['GITHUB_TOKEN']
  if (!token || token.trim() === '') return null
  return token
}

export const selectConnectedPullRequestNumber = (
  branch: string,
  pullRequests: readonly Github.PullRequest[],
): Effect.Effect<number | null, ExplorerError> =>
  selectConnectedPullRequest(branch, pullRequests).pipe(
    Effect.map((pullRequest) => pullRequest?.number ?? null),
  )

export const selectConnectedPullRequest = (
  branch: string,
  pullRequests: readonly Github.PullRequest[],
): Effect.Effect<Github.PullRequest | null, ExplorerError> =>
  Effect.gen(function* () {
    const matches = pullRequests.filter((pullRequest) => pullRequest.head.ref === branch)

    if (matches.length === 0) return null
    if (matches.length === 1) return matches[0]!

    return yield* Effect.fail(
      new ExplorerError({
        context: {
          detail:
            `Multiple open pull requests match branch "${branch}": ` +
            matches.map((pullRequest) => `#${String(pullRequest.number)}`).join(', ') +
            '. Set PR_NUMBER explicitly or close the extra pull requests.',
        },
      }),
    )
  })

export const selectPullRequestByNumber = (
  prNumber: number,
  pullRequests: readonly Github.PullRequest[],
): Effect.Effect<Github.PullRequest | null, ExplorerError> =>
  Effect.gen(function* () {
    const matches = pullRequests.filter((pullRequest) => pullRequest.number === prNumber)

    if (matches.length === 0) return null
    if (matches.length === 1) return matches[0]!

    return yield* Effect.fail(
      new ExplorerError({
        context: {
          detail:
            `Multiple open pull requests matched PR number #${String(prNumber)}. ` +
            'Close the extra pull requests or provide a unique PR context.',
        },
      }),
    )
  })

export const resolvePullRequest = (): Effect.Effect<
  Github.PullRequest | null,
  | ExplorerError
  | Git.GitError
  | Git.GitParseError
  | Github.GithubError
  | Github.GithubNotFoundError
  | Github.GithubAuthError
  | Github.GithubRateLimitError,
  Env.Env | Git.Git
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const git = yield* Git.Git
    const prNumber = detectPrNumber(env.vars)
    const prTitle = detectPrTitle(env.vars)
    const prBody = detectPrBody(env.vars)
    const branch = yield* git.getCurrentBranch()
    const target = yield* resolveReleaseTarget(env.vars)

    if (prNumber !== null && prTitle !== null) {
      return {
        number: prNumber,
        html_url: `https://github.com/${target.owner}/${target.repo}/pull/${String(prNumber)}`,
        title: prTitle,
        body: prBody,
        head: { ref: branch },
      } satisfies Github.PullRequest
    }

    const token = resolveGithubToken(env.vars) ?? undefined
    const pullRequests = yield* Github.Github.pipe(
      Effect.flatMap((github) => github.listOpenPullRequests()),
      Effect.provide(
        Github.LiveFetch({ owner: target.owner, repo: target.repo, ...(token ? { token } : {}) }),
      ),
    )

    if (prNumber !== null) {
      return yield* selectPullRequestByNumber(prNumber, pullRequests)
    }

    return yield* selectConnectedPullRequest(branch, pullRequests)
  })

export const resolvePrNumber = (): Effect.Effect<
  number | null,
  | ExplorerError
  | Git.GitError
  | Git.GitParseError
  | Github.GithubError
  | Github.GithubNotFoundError
  | Github.GithubAuthError
  | Github.GithubRateLimitError,
  Env.Env | Git.Git
> => resolvePullRequest().pipe(Effect.map((pullRequest) => pullRequest?.number ?? null))

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Gather environmental reconnaissance — all facts about the release
 * environment needed before analysis or execution begins.
 */
export const explore = (): Effect.Effect<
  Recon,
  ExplorerError | Git.GitError | Git.GitParseError,
  Env.Env | Git.Git
> =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const git = yield* Git.Git
    const vars = env.vars

    const ci = detectExecutionContext(vars)
    const target = yield* resolveReleaseTarget(vars)
    const githubToken = resolveGithubToken(vars)

    // Gather real git state
    const branch = yield* git.getCurrentBranch()
    const headSha = yield* git.getHeadSha()
    const isClean = yield* git.isClean()

    // Detect shallow clone (CI environments commonly use --depth=1)
    const isShallow =
      vars['GIT_DEPTH'] === '1' ||
      (vars['GITHUB_ACTIONS'] === 'true' && vars['GITHUB_EVENT_NAME'] === 'pull_request')
    if (isShallow) {
      yield* Effect.logWarning(
        'Shallow git clone detected. Release analysis requires full history to find ' +
          'release tags and compute version bumps. In GitHub Actions, add ' +
          '`fetch-depth: 0` to your actions/checkout step.',
      )
    }

    return {
      ci,
      github: {
        target,
        credentials: githubToken
          ? { token: githubToken, source: 'env:GITHUB_TOKEN' as const }
          : null,
      },
      npm: {
        authenticated: false,
        username: null,
        registry: 'https://registry.npmjs.org',
      },
      git: {
        clean: isClean,
        branch,
        headSha,
        remotes: {},
      },
    } satisfies Recon
  })

/**
 * Bridge function: convert a Recon snapshot to the config shape that
 * the executor's workflow runtime layer expects.
 */
export const toExecutorRuntimeConfig = (recon: Recon): RuntimeConfig => {
  const config: RuntimeConfig = {}
  if (recon.github.target && recon.github.credentials) {
    return {
      ...config,
      github: {
        owner: recon.github.target.owner,
        repo: recon.github.target.repo,
        token: recon.github.credentials.token,
      },
    }
  }
  return config
}
