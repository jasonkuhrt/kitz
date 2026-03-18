import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import type { Recon } from './models/__.js'
import { explore, toExecutorRuntimeConfig } from './explore.js'

const makeNpmCliLayer = (options?: {
  readonly username?: string
  readonly onWhoami?: (options: { readonly registry?: string } | undefined) => void
}) =>
  Layer.succeed(NpmRegistry.NpmCli, {
    whoami: (whoamiOptions) => {
      options?.onWhoami?.(whoamiOptions)
      return Effect.succeed(options?.username ?? 'npm-user')
    },
    pack: () => Effect.die('unexpected npm pack call in explore test'),
    publish: () => Effect.die('unexpected npm publish call in explore test'),
  })

const runExplore = (
  vars: Record<string, string | undefined>,
  gitConfig: Parameters<typeof Git.Memory.make>[0] = {},
  npmOptions?: Parameters<typeof makeNpmCliLayer>[0],
) =>
  Effect.runPromise(
    explore().pipe(
      Effect.provide(
        Layer.mergeAll(Env.Test({ vars }), Git.Memory.make(gitConfig), makeNpmCliLayer(npmOptions)),
      ),
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

  test('reports discovered npm auth and origin remote instead of placeholders', async () => {
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
      expect(result.success.npm).toEqual({
        authenticated: true,
        username: 'npm-user',
        registry: null,
      })
      expect(result.success.git.remotes).toEqual({
        origin: 'git@github.com:jasonkuhrt/kitz.git',
      })
    }
  })

  test('lets npm resolve registry config when no registry env var is set', async () => {
    let seenWhoamiOptions: { readonly registry?: string } | undefined

    const result = await runExplore(
      {
        GITHUB_TOKEN: 'token-123',
      },
      {
        remoteUrl: 'git@github.com:jasonkuhrt/kitz.git',
      },
      {
        onWhoami: (options) => {
          seenWhoamiOptions = options
        },
      },
    )

    expect(result._tag).toBe('Success')
    if (result._tag === 'Success') {
      expect(seenWhoamiOptions).toBeUndefined()
      expect(result.success.npm.registry).toBeNull()
    }
  })

  test('reports the explicit npm registry from environment when one is set', async () => {
    let seenWhoamiOptions: { readonly registry?: string } | undefined

    const result = await runExplore(
      {
        GITHUB_TOKEN: 'token-123',
        NPM_CONFIG_REGISTRY: 'https://npm.pkg.github.com',
      },
      {
        remoteUrl: 'git@github.com:jasonkuhrt/kitz.git',
      },
      {
        onWhoami: (options) => {
          seenWhoamiOptions = options
        },
      },
    )

    expect(result._tag).toBe('Success')
    if (result._tag === 'Success') {
      expect(seenWhoamiOptions).toEqual({ registry: 'https://npm.pkg.github.com' })
      expect(result.success.npm.registry).toBe('https://npm.pkg.github.com')
    }
  })
})

describe('toExecutorRuntimeConfig', () => {
  test('maps recon to executor runtime github config', () => {
    const recon: Recon = {
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
        root: '/repo/' as unknown as Recon['git']['root'],
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
