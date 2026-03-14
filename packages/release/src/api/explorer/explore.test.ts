import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { explore, toExecutorRuntimeConfig } from './explore.js'

const runExplore = (
  vars: Record<string, string | undefined>,
  gitConfig: Parameters<typeof Git.Memory.make>[0] = {},
) =>
  Effect.runPromise(
    explore().pipe(
      Effect.provide(Layer.mergeAll(Env.Test({ vars }), Git.Memory.make(gitConfig))),
      Effect.result,
    ),
  )

describe('explore', () => {
  test('resolves in CI from GITHUB_REPOSITORY + GITHUB_TOKEN', async () => {
    const result = await runExplore({
      CI: 'true',
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'kitz-org/kitz',
      GITHUB_TOKEN: 'token-123',
    })

    expect(result._tag).toBe('Success')
    if (result._tag === 'Success') {
      expect(result.success.ci).toEqual({
        detected: true,
        provider: 'github-actions',
        prNumber: null,
      })
      expect(result.success.github.target).toEqual({
        owner: 'kitz-org',
        repo: 'kitz',
        source: 'env:GITHUB_REPOSITORY',
      })
    }
  })

  test('resolves locally from origin remote + GITHUB_TOKEN', async () => {
    const result = await runExplore(
      {
        GITHUB_TOKEN: 'token-123',
      },
      {
        remoteUrl: 'git@github.com:jasonkuhrt/kitz.git',
      },
    )

    expect(result._tag).toBe('Success')
    if (result._tag === 'Success') {
      expect(result.success.ci).toEqual({ detected: false, provider: null, prNumber: null })
      expect(result.success.github.target).toEqual({
        owner: 'jasonkuhrt',
        repo: 'kitz',
        source: 'git:origin',
      })
    }
  })

  test('resolves locally from GITHUB_REPOSITORY + GITHUB_TOKEN even if remote is not github', async () => {
    const result = await runExplore(
      {
        GITHUB_REPOSITORY: 'kitz-org/kitz',
        GITHUB_TOKEN: 'token-123',
      },
      {
        remoteUrl: 'git@example.com:infra/release.git',
      },
    )

    expect(result._tag).toBe('Success')
    if (result._tag === 'Success') {
      expect(result.success.github.target!.source).toBe('env:GITHUB_REPOSITORY')
      expect(result.success.github.target!.owner).toBe('kitz-org')
      expect(result.success.github.target!.repo).toBe('kitz')
    }
  })

  test('succeeds with null credentials when token is missing', async () => {
    const result = await runExplore({
      GITHUB_REPOSITORY: 'kitz-org/kitz',
    })

    expect(result._tag).toBe('Success')
    if (result._tag === 'Success') {
      expect(result.success.github.target).toEqual({
        owner: 'kitz-org',
        repo: 'kitz',
        source: 'env:GITHUB_REPOSITORY',
      })
      expect(result.success.github.credentials).toBeNull()
    }
  })

  test('fails when GITHUB_REPOSITORY format is invalid', async () => {
    const result = await runExplore({
      GITHUB_REPOSITORY: 'invalid-repo-format',
      GITHUB_TOKEN: 'token-123',
    })

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('ExplorerError')
      expect(result.failure.context.detail).toContain('Invalid GITHUB_REPOSITORY format')
    }
  })

  test('fails when neither env repository nor github origin is available', async () => {
    const result = await runExplore(
      {
        GITHUB_TOKEN: 'token-123',
      },
      {
        remoteUrl: 'git@example.com:infra/release.git',
      },
    )

    expect(result._tag).toBe('Failure')
    if (result._tag === 'Failure') {
      expect(result.failure._tag).toBe('ExplorerError')
      expect(result.failure.context.detail).toContain(
        'Could not resolve GitHub repository from origin remote',
      )
    }
  })
})

describe('toExecutorRuntimeConfig', () => {
  test('maps recon to executor runtime github config', () => {
    const recon = {
      ci: { detected: false as const, provider: null, prNumber: null },
      github: {
        target: {
          owner: 'jasonkuhrt',
          repo: 'kitz',
          source: 'git:origin' as const,
        },
        credentials: {
          token: 'token-123',
          source: 'env:GITHUB_TOKEN' as const,
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
        headSha: 'abc1234',
        remotes: {},
      },
    }

    const config = toExecutorRuntimeConfig(recon)
    expect(config).toEqual({
      github: {
        owner: 'jasonkuhrt',
        repo: 'kitz',
        token: 'token-123',
      },
    })
  })
})
