import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { resolveReleaseRuntime, toWorkflowRuntimeConfig } from './runtime.js'

const runResolveRuntime = (
  vars: Record<string, string | undefined>,
  gitConfig: Parameters<typeof Git.Memory.make>[0] = {},
) =>
  Effect.runPromise(
    resolveReleaseRuntime().pipe(
      Effect.provide(Layer.mergeAll(Env.Test({ vars }), Git.Memory.make(gitConfig))),
      Effect.either,
    ),
  )

describe('resolveReleaseRuntime', () => {
  test('resolves in CI from GITHUB_REPOSITORY + GITHUB_TOKEN', async () => {
    const result = await runResolveRuntime({
      CI: 'true',
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'kitz-org/kitz',
      GITHUB_TOKEN: 'token-123',
    })

    expect(result._tag).toBe('Right')
    if (result._tag === 'Right') {
      expect(result.right.executionContext).toEqual({ kind: 'ci', ciProvider: 'github-actions' })
      expect(result.right.target).toEqual({
        provider: 'github',
        owner: 'kitz-org',
        repo: 'kitz',
        source: 'env:GITHUB_REPOSITORY',
      })
    }
  })

  test('resolves locally from origin remote + GITHUB_TOKEN', async () => {
    const result = await runResolveRuntime(
      {
        GITHUB_TOKEN: 'token-123',
      },
      {
        remoteUrl: 'git@github.com:jasonkuhrt/kitz.git',
      },
    )

    expect(result._tag).toBe('Right')
    if (result._tag === 'Right') {
      expect(result.right.executionContext).toEqual({ kind: 'local' })
      expect(result.right.target).toEqual({
        provider: 'github',
        owner: 'jasonkuhrt',
        repo: 'kitz',
        source: 'git:origin',
      })
    }
  })

  test('resolves locally from GITHUB_REPOSITORY + GITHUB_TOKEN even if remote is not github', async () => {
    const result = await runResolveRuntime(
      {
        GITHUB_REPOSITORY: 'kitz-org/kitz',
        GITHUB_TOKEN: 'token-123',
      },
      {
        remoteUrl: 'git@example.com:infra/release.git',
      },
    )

    expect(result._tag).toBe('Right')
    if (result._tag === 'Right') {
      expect(result.right.target.source).toBe('env:GITHUB_REPOSITORY')
      expect(result.right.target.owner).toBe('kitz-org')
      expect(result.right.target.repo).toBe('kitz')
    }
  })

  test('fails when token is missing', async () => {
    const result = await runResolveRuntime(
      {
        GITHUB_REPOSITORY: 'kitz-org/kitz',
      },
    )

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('RuntimeResolutionError')
      expect(result.left.context.detail).toContain('Missing GITHUB_TOKEN')
    }
  })

  test('fails when GITHUB_REPOSITORY format is invalid', async () => {
    const result = await runResolveRuntime({
      GITHUB_REPOSITORY: 'invalid-repo-format',
      GITHUB_TOKEN: 'token-123',
    })

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('RuntimeResolutionError')
      expect(result.left.context.detail).toContain('Invalid GITHUB_REPOSITORY format')
    }
  })

  test('fails when neither env repository nor github origin is available', async () => {
    const result = await runResolveRuntime(
      {
        GITHUB_TOKEN: 'token-123',
      },
      {
        remoteUrl: 'git@example.com:infra/release.git',
      },
    )

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('RuntimeResolutionError')
      expect(result.left.context.detail).toContain('Could not resolve GitHub repository from origin remote')
    }
  })
})

describe('toWorkflowRuntimeConfig', () => {
  test('maps runtime to workflow runtime github config', () => {
    const runtime = {
      executionContext: { kind: 'local' as const },
      target: {
        provider: 'github' as const,
        owner: 'jasonkuhrt',
        repo: 'kitz',
        source: 'git:origin' as const,
      },
      credentials: {
        githubToken: 'token-123',
        source: 'env:GITHUB_TOKEN' as const,
      },
      capabilities: {
        canCreateRemoteRelease: true as const,
      },
    }

    const config = toWorkflowRuntimeConfig(runtime)
    expect(config).toEqual({
      github: {
        owner: 'jasonkuhrt',
        repo: 'kitz',
        token: 'token-123',
      },
    })
  })
})
