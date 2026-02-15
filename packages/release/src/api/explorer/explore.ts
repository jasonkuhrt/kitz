import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Effect } from 'effect'
import type { RuntimeConfig } from '../executor/runtime.js'
import { ExplorerError } from './errors.js'
import type { CiContext, GitIdentity, Recon } from './models/__.js'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const detectExecutionContext = (vars: Record<string, string | undefined>): CiContext => {
  if (vars['GITHUB_ACTIONS'] === 'true') {
    return { detected: true, provider: 'github-actions' }
  }
  if (vars['CI'] === 'true') {
    return { detected: true, provider: 'generic' }
  }
  return { detected: false, provider: null }
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
): Effect.Effect<string, ExplorerError> => {
  const token = vars['GITHUB_TOKEN']
  if (!token || token.trim() === '') {
    return Effect.fail(
      new ExplorerError({
        context: {
          detail: 'Missing GITHUB_TOKEN. Export GITHUB_TOKEN with a token that can create releases.',
        },
      }),
    )
  }
  return Effect.succeed(token)
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
  ExplorerError,
  Env.Env | Git.Git
> =>
  Effect.gen(function*() {
    const env = yield* Env.Env
    const vars = env.vars

    const ci = detectExecutionContext(vars)
    const target = yield* resolveReleaseTarget(vars)
    const githubToken = yield* resolveGithubToken(vars)

    return {
      ci,
      github: {
        target,
        credentials: {
          token: githubToken,
          source: 'env:GITHUB_TOKEN',
        },
      },
      npm: {
        authenticated: false,
        username: null,
        registry: 'https://registry.npmjs.org',
      },
      git: {
        clean: true,
        branch: 'main',
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
