import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Effect } from 'effect'
import type { RuntimeConfig } from '../executor/runtime.js'
import { ExplorerError } from './errors.js'
import type { CiContext, GitIdentity, Recon } from './models/__.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

const parseGitHubRepository = (value: string): { owner: string; repo: string } | null => {
  const trimmed = value.trim()
  const parts = trimmed.split('/')
  if (parts.length !== 2) return null
  const owner = parts[0]
  const repo = parts[1]
  if (!owner || !repo) return null
  return { owner, repo }
}

const parseGitHubRemote = (url: string): { owner: string; repo: string } | null => {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) return null
  return { owner: match[1]!, repo: match[2]! }
}

export const resolveReleaseTarget = (
  vars: Record<string, string | undefined>,
): Effect.Effect<GitIdentity, ExplorerError, Git.Git> =>
  Effect.gen(function*() {
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
              detail:
                `Could not read git remote "origin". Set GITHUB_REPOSITORY="<owner>/<repo>" or configure origin to github.com. (${error.message})`,
            },
          }),
        )
      ),
    )

    const parsedRemote = parseGitHubRemote(remoteUrl)
    if (!parsedRemote) {
      return yield* Effect.fail(
        new ExplorerError({
          context: {
            detail:
              `Could not resolve GitHub repository from origin remote "${remoteUrl}". Set GITHUB_REPOSITORY="<owner>/<repo>" or configure origin to github.com.`,
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

const resolveGithubToken = (
  vars: Record<string, string | undefined>,
): string | null => {
  const token = vars['GITHUB_TOKEN']
  if (!token || token.trim() === '') return null
  return token
}

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
  Effect.gen(function*() {
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
