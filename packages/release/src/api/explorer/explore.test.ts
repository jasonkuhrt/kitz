import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  detectPrNumber,
  explore,
  resolvePrNumber,
  resolvePullRequest,
  resolveReleaseTarget,
  selectConnectedPullRequest,
  selectConnectedPullRequestNumber,
  selectPullRequestByNumber,
  toExecutorRuntimeConfig,
} from './explore.js'

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
  test('detects PR numbers from CI pull request URLs and explores shallow clones', async () => {
    const result = await runExplore(
      {
        CI: 'true',
        CI_PULL_REQUEST: 'https://github.com/kitz-org/kitz/pull/129',
        GITHUB_REPOSITORY: 'kitz-org/kitz',
        GIT_DEPTH: '1',
      },
      {
        branch: 'feature/release',
      },
    )

    expect(detectPrNumber({ CI_PULL_REQUEST: 'https://github.com/kitz-org/kitz/pull/129' })).toBe(
      129,
    )
    expect(result._tag).toBe('Success')
    if (result._tag === 'Success') {
      expect(result.success.ci).toEqual({
        detected: true,
        provider: 'generic',
        prNumber: 129,
      })
    }
  })

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

describe('explorer helpers', () => {
  const pullRequests = [
    {
      number: 12,
      html_url: 'https://github.com/kitz-org/kitz/pull/12',
      title: 'First',
      body: null,
      base: { ref: 'main' },
      head: { ref: 'feature/release' },
    },
    {
      number: 34,
      html_url: 'https://github.com/kitz-org/kitz/pull/34',
      title: 'Second',
      body: null,
      base: { ref: 'main' },
      head: { ref: 'feature/release' },
    },
  ] as const

  test('matches pull requests by branch and number, including ambiguous failures', async () => {
    const none = await Effect.runPromise(selectConnectedPullRequest('main', pullRequests))
    const number = await Effect.runPromise(
      selectConnectedPullRequestNumber('missing-branch', pullRequests),
    )
    const direct = await Effect.runPromise(selectPullRequestByNumber(12, pullRequests))
    const duplicateByBranch = await Effect.runPromise(
      selectConnectedPullRequest('feature/release', pullRequests).pipe(Effect.result),
    )
    const duplicateByNumber = await Effect.runPromise(
      selectPullRequestByNumber(34, [...pullRequests, pullRequests[1]!]).pipe(Effect.result),
    )

    expect(none).toBeNull()
    expect(number).toBeNull()
    expect(direct?.number).toBe(12)
    expect(duplicateByBranch._tag).toBe('Failure')
    expect(duplicateByNumber._tag).toBe('Failure')
  })

  test('resolves release targets from trimmed repository env values', async () => {
    const target = await Effect.runPromise(
      resolveReleaseTarget({ GITHUB_REPOSITORY: '  kitz-org/kitz  ' }).pipe(
        Effect.provide(Git.Memory.make({})),
      ),
    )

    expect(target).toEqual({
      owner: 'kitz-org',
      repo: 'kitz',
      source: 'env:GITHUB_REPOSITORY',
    })
  })

  test('resolves pull requests through injected listing dependencies', async () => {
    const listedPullRequests = [
      {
        number: 51,
        html_url: 'https://github.com/kitz-org/kitz/pull/51',
        title: 'feat(core): release',
        body: null,
        base: { ref: 'main' },
        head: { ref: 'feature/release' },
      },
    ] as const
    const seen: Array<{ owner: string; repo: string; token?: string }> = []

    const resolvedPullRequest = await Effect.runPromise(
      resolvePullRequest({
        listOpenPullRequests: (params) => {
          seen.push(params)
          return Effect.succeed(listedPullRequests)
        },
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Env.Test({
              vars: {
                GITHUB_REPOSITORY: 'kitz-org/kitz',
                GITHUB_TOKEN: 'token-123',
                PR_NUMBER: '51',
              },
            }),
            Git.Memory.make({ branch: 'feature/release' }),
          ),
        ),
      ),
    )

    const resolvedNumber = await Effect.runPromise(
      resolvePrNumber({
        listOpenPullRequests: () => Effect.succeed(listedPullRequests),
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            Env.Test({
              vars: {
                GITHUB_REPOSITORY: 'kitz-org/kitz',
                GITHUB_TOKEN: 'token-123',
              },
            }),
            Git.Memory.make({ branch: 'feature/release' }),
          ),
        ),
      ),
    )

    expect(resolvedPullRequest?.number).toBe(51)
    expect(resolvedNumber).toBe(51)
    expect(seen).toEqual([{ owner: 'kitz-org', repo: 'kitz', token: 'token-123' }])
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

  test('returns an empty config when github credentials are unavailable', () => {
    expect(
      toExecutorRuntimeConfig({
        ci: { detected: false, provider: null, prNumber: null },
        github: {
          target: {
            owner: 'jasonkuhrt',
            repo: 'kitz',
            source: 'git:origin',
          },
          credentials: null,
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
      }),
    ).toEqual({})
  })
})
