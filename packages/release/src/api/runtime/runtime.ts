import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Effect, Schema as S } from 'effect'
import type { WorkflowRuntimeConfig } from '../workflow.js'
import type { ExecutionContext, ReleaseRuntime, ReleaseTarget } from './models.js'

const baseTags = ['kit', 'release', 'runtime'] as const

export const RuntimeResolutionError = Err.TaggedContextualError(
  'RuntimeResolutionError',
  baseTags,
  {
    context: S.Struct({
      detail: S.String,
    }),
    message: (ctx) => `Failed to resolve release runtime: ${ctx.detail}`,
  },
)

export type RuntimeResolutionError = InstanceType<typeof RuntimeResolutionError>

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

export const detectExecutionContext = (vars: Record<string, string | undefined>): ExecutionContext => {
  if (vars['GITHUB_ACTIONS'] === 'true') {
    return { kind: 'ci', ciProvider: 'github-actions' }
  }
  if (vars['CI'] === 'true') {
    return { kind: 'ci', ciProvider: 'generic' }
  }
  return { kind: 'local' }
}

const resolveReleaseTarget = (
  vars: Record<string, string | undefined>,
): Effect.Effect<ReleaseTarget, RuntimeResolutionError, Git.Git> =>
  Effect.gen(function*() {
    const repository = vars['GITHUB_REPOSITORY']
    if (repository !== undefined) {
      const parsed = parseGitHubRepository(repository)
      if (!parsed) {
        return yield* Effect.fail(
          new RuntimeResolutionError({
            context: {
              detail: `Invalid GITHUB_REPOSITORY format "${repository}". Expected "<owner>/<repo>".`,
            },
          }),
        )
      }
      return {
        provider: 'github',
        owner: parsed.owner,
        repo: parsed.repo,
        source: 'env:GITHUB_REPOSITORY',
      } satisfies ReleaseTarget
    }

    const git = yield* Git.Git
    const remoteUrl = yield* git.getRemoteUrl('origin').pipe(
      Effect.catchAll((error) =>
        Effect.fail(
          new RuntimeResolutionError({
            context: {
              detail: `Could not read git remote "origin". Set GITHUB_REPOSITORY="<owner>/<repo>" or configure origin to github.com. (${error.message})`,
            },
          }),
        )
      ),
    )

    const parsedRemote = parseGitHubRemote(remoteUrl)
    if (!parsedRemote) {
      return yield* Effect.fail(
        new RuntimeResolutionError({
          context: {
            detail: `Could not resolve GitHub repository from origin remote "${remoteUrl}". Set GITHUB_REPOSITORY="<owner>/<repo>" or configure origin to github.com.`,
          },
        }),
      )
    }

    return {
      provider: 'github',
      owner: parsedRemote.owner,
      repo: parsedRemote.repo,
      source: 'git:origin',
    } satisfies ReleaseTarget
  })

const resolveGithubToken = (vars: Record<string, string | undefined>): Effect.Effect<string, RuntimeResolutionError> => {
  const token = vars['GITHUB_TOKEN']
  if (!token || token.trim() === '') {
    return Effect.fail(
      new RuntimeResolutionError({
        context: {
          detail: 'Missing GITHUB_TOKEN. Export GITHUB_TOKEN with a token that can create releases.',
        },
      }),
    )
  }
  return Effect.succeed(token)
}

/**
 * Resolve semantic runtime for release execution from environment and git context.
 *
 * Local and CI are both first-class execution contexts. Runtime fails only when
 * required release identity/credentials are missing.
 */
export const resolveReleaseRuntime = (): Effect.Effect<
  ReleaseRuntime,
  RuntimeResolutionError,
  Env.Env | Git.Git
> =>
  Effect.gen(function*() {
    const env = yield* Env.Env
    const vars = env.vars

    const executionContext = detectExecutionContext(vars)
    const target = yield* resolveReleaseTarget(vars)
    const githubToken = yield* resolveGithubToken(vars)

    return {
      executionContext,
      target,
      credentials: {
        githubToken,
        source: 'env:GITHUB_TOKEN',
      },
      capabilities: {
        canCreateRemoteRelease: true,
      },
    } satisfies ReleaseRuntime
  })

/**
 * Adapt semantic runtime into workflow runtime config.
 */
export const toWorkflowRuntimeConfig = (runtime: ReleaseRuntime): WorkflowRuntimeConfig => ({
  github: {
    owner: runtime.target.owner,
    repo: runtime.target.repo,
    token: runtime.credentials.githubToken,
  },
})
