import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Test } from '@kitz/test'
import { Effect, Result, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  detectPrNumber,
  resolveGitHubContext,
  resolvePullRequestFromContext,
  resolveReleaseTarget,
  selectConnectedPullRequest,
  selectConnectedPullRequestNumber,
  selectPullRequestByNumber,
} from './explore.js'

// ── detectPrNumber ───────────────────────────────────────────────────

describe('detectPrNumber', () => {
  Test.describe('environment variable detection')
    .inputType<Record<string, string | undefined>>()
    .outputType<number | null>()
    .cases(
      {
        input: { GITHUB_PR_NUMBER: '42' },
        output: 42,
        comment: 'GITHUB_PR_NUMBER takes priority',
      },
      {
        input: { PR_NUMBER: '123' },
        output: 123,
        comment: 'PR_NUMBER fallback',
      },
      {
        input: { CI_PULL_REQUEST: 'https://github.com/org/repo/pull/99' },
        output: 99,
        comment: 'CI_PULL_REQUEST URL extraction',
      },
      {
        input: { GITHUB_PR_NUMBER: '42', PR_NUMBER: '99' },
        output: 42,
        comment: 'GITHUB_PR_NUMBER wins over PR_NUMBER',
      },
      {
        input: {},
        output: null,
        comment: 'no env vars returns null',
      },
      {
        input: { GITHUB_PR_NUMBER: 'not-a-number' },
        output: null,
        comment: 'NaN values are rejected',
      },
      {
        input: { CI_PULL_REQUEST: 'https://github.com/org/repo/issues/5' },
        output: null,
        comment: 'issues URL does not match pull pattern',
      },
    )
    .test(({ input, output }) => {
      expect(detectPrNumber(input)).toBe(output)
    })
})

// ── resolveReleaseTarget ─────────────────────────────────────────────

describe('resolveReleaseTarget', () => {
  const run = (
    vars: Record<string, string | undefined>,
    gitConfig: Parameters<typeof Git.Memory.make>[0] = {},
  ) =>
    Effect.runPromise(
      resolveReleaseTarget(vars).pipe(Effect.provide(Git.Memory.make(gitConfig)), Effect.result),
    )

  test('HTTPS remote URL', async () => {
    const result = await run(
      {},
      {
        remoteUrl: 'https://github.com/org/repo.git',
      },
    )
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.success.owner).toBe('org')
      expect(result.success.repo).toBe('repo')
      expect(result.success.source).toBe('git:origin')
    }
  })

  test('SSH remote URL', async () => {
    const result = await run(
      {},
      {
        remoteUrl: 'git@github.com:my-org/my-repo.git',
      },
    )
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.success.owner).toBe('my-org')
      expect(result.success.repo).toBe('my-repo')
    }
  })

  test('HTTPS remote URL without .git suffix', async () => {
    const result = await run(
      {},
      {
        remoteUrl: 'https://github.com/owner/project',
      },
    )
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.success.owner).toBe('owner')
      expect(result.success.repo).toBe('project')
    }
  })

  test('GITHUB_REPOSITORY takes priority over git remote', async () => {
    const result = await run(
      { GITHUB_REPOSITORY: 'env-org/env-repo' },
      { remoteUrl: 'git@github.com:git-org/git-repo.git' },
    )
    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.success.owner).toBe('env-org')
      expect(result.success.repo).toBe('env-repo')
      expect(result.success.source).toBe('env:GITHUB_REPOSITORY')
    }
  })

  test('invalid GITHUB_REPOSITORY format fails', async () => {
    const result = await run({ GITHUB_REPOSITORY: 'no-slash' })
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe('ExplorerError')
    }
  })

  test('non-github remote fails', async () => {
    const result = await run(
      {},
      {
        remoteUrl: 'git@gitlab.com:org/repo.git',
      },
    )
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe('ExplorerError')
      expect(result.failure.context.detail).toContain('Could not resolve GitHub repository')
    }
  })
})

describe('resolveGitHubContext', () => {
  const run = (
    vars: Record<string, string | undefined>,
    gitConfig: Parameters<typeof Git.Memory.make>[0] = {},
  ) =>
    Effect.runPromise(
      resolveGitHubContext().pipe(
        Effect.provide(Layer.mergeAll(Env.Test({ vars }), Git.Memory.make(gitConfig))),
        Effect.result,
      ),
    )

  test('collects branch, explicit PR number, target, and token once', async () => {
    const result = await run(
      {
        GITHUB_REPOSITORY: 'kitz-org/kitz',
        GITHUB_PR_NUMBER: '129',
        GITHUB_TOKEN: 'token-123',
      },
      {
        branch: 'feat/release-preview',
        remoteUrl: 'git@github.com:other/ignored.git',
      },
    )

    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.success).toEqual({
        branch: 'feat/release-preview',
        explicitPrNumber: 129,
        target: {
          owner: 'kitz-org',
          repo: 'kitz',
          source: 'env:GITHUB_REPOSITORY',
        },
        token: 'token-123',
      })
    }
  })

  test('falls back to origin remote and no explicit PR when env is absent', async () => {
    const result = await run(
      {},
      {
        branch: 'feat/release-preview',
        remoteUrl: 'git@github.com:jasonkuhrt/kitz.git',
      },
    )

    expect(Result.isSuccess(result)).toBe(true)
    if (Result.isSuccess(result)) {
      expect(result.success.branch).toBe('feat/release-preview')
      expect(result.success.explicitPrNumber).toBeNull()
      expect(result.success.target).toEqual({
        owner: 'jasonkuhrt',
        repo: 'kitz',
        source: 'git:origin',
      })
      expect(result.success.token).toBeNull()
    }
  })
})

describe('resolvePullRequestFromContext', () => {
  test('prefers an explicit PR number over branch matching', async () => {
    const result = await Effect.runPromise(
      resolvePullRequestFromContext({
        branch: 'feat/release-preview',
        explicitPrNumber: 130,
        target: {
          owner: 'jasonkuhrt',
          repo: 'kitz',
          source: 'git:origin',
        },
        token: 'token-123',
      }).pipe(
        Effect.provide(
          Github.Memory.make({
            pullRequests: [
              {
                number: 129,
                html_url: 'https://github.com/jasonkuhrt/kitz/pull/129',
                title: 'feat(release): improve doctor output',
                body: '',
                base: { ref: 'main' },
                head: { ref: 'feat/release-preview' },
              },
              {
                number: 130,
                html_url: 'https://github.com/jasonkuhrt/kitz/pull/130',
                title: 'feat(release): improve forecast output',
                body: '',
                base: { ref: 'main' },
                head: { ref: 'feat/other' },
              },
            ] satisfies readonly Github.PullRequest[],
          }),
        ),
      ),
    )

    expect(result?.number).toBe(130)
  })
})

describe('selectConnectedPullRequestNumber', () => {
  test('returns the matching pull request for the current branch', async () => {
    const result = await Effect.runPromise(
      selectConnectedPullRequestNumber('feat/release', [
        {
          number: 129,
          html_url: 'https://github.com/jasonkuhrt/kitz/pull/129',
          title: 'feat(release): improve doctor output',
          body: '',
          base: { ref: 'main' },
          head: { ref: 'feat/release' },
        },
      ] satisfies readonly Github.PullRequest[]),
    )

    expect(result).toBe(129)
  })

  test('returns null when no open pull request matches the branch', async () => {
    const result = await Effect.runPromise(
      selectConnectedPullRequestNumber('feat/release', [
        {
          number: 128,
          html_url: 'https://github.com/jasonkuhrt/kitz/pull/128',
          title: 'feat(core): other change',
          body: '',
          base: { ref: 'main' },
          head: { ref: 'feat/other' },
        },
      ] satisfies readonly Github.PullRequest[]),
    )

    expect(result).toBeNull()
  })

  test('fails when multiple open pull requests match the same branch', async () => {
    const result = await Effect.runPromise(
      selectConnectedPullRequestNumber('feat/release', [
        {
          number: 129,
          html_url: 'https://github.com/jasonkuhrt/kitz/pull/129',
          title: 'feat(release): improve doctor output',
          body: '',
          base: { ref: 'main' },
          head: { ref: 'feat/release' },
        },
        {
          number: 130,
          html_url: 'https://github.com/jasonkuhrt/kitz/pull/130',
          title: 'feat(release): improve forecast output',
          body: '',
          base: { ref: 'main' },
          head: { ref: 'feat/release' },
        },
      ] satisfies readonly Github.PullRequest[]).pipe(Effect.result),
    )

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure.context.detail).toContain('Multiple open pull requests match branch')
    }
  })
})

describe('selectConnectedPullRequest', () => {
  test('returns the matching pull request object for the current branch', async () => {
    const result = await Effect.runPromise(
      selectConnectedPullRequest('feat/release', [
        {
          number: 129,
          html_url: 'https://github.com/jasonkuhrt/kitz/pull/129',
          title: 'feat(release): improve doctor output',
          body: 'body',
          base: { ref: 'main' },
          head: { ref: 'feat/release' },
        },
      ] satisfies readonly Github.PullRequest[]),
    )

    expect(result?.title).toBe('feat(release): improve doctor output')
  })
})

describe('selectPullRequestByNumber', () => {
  test('returns the matching pull request object for the PR number', async () => {
    const result = await Effect.runPromise(
      selectPullRequestByNumber(129, [
        {
          number: 129,
          html_url: 'https://github.com/jasonkuhrt/kitz/pull/129',
          title: 'feat(release): improve doctor output',
          body: 'body',
          base: { ref: 'main' },
          head: { ref: 'feat/release' },
        },
      ] satisfies readonly Github.PullRequest[]),
    )

    expect(result?.head.ref).toBe('feat/release')
  })
})
