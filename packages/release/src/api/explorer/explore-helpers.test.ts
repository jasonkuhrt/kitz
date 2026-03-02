import { Git } from '@kitz/git'
import { Test } from '@kitz/test'
import { Effect, Either, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { detectPrNumber, resolveReleaseTarget } from './explore.js'

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
      resolveReleaseTarget(vars).pipe(
        Effect.provide(Git.Memory.make(gitConfig)),
        Effect.either,
      ),
    )

  test('HTTPS remote URL', async () => {
    const result = await run({}, {
      remoteUrl: 'https://github.com/org/repo.git',
    })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.owner).toBe('org')
      expect(result.right.repo).toBe('repo')
      expect(result.right.source).toBe('git:origin')
    }
  })

  test('SSH remote URL', async () => {
    const result = await run({}, {
      remoteUrl: 'git@github.com:my-org/my-repo.git',
    })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.owner).toBe('my-org')
      expect(result.right.repo).toBe('my-repo')
    }
  })

  test('HTTPS remote URL without .git suffix', async () => {
    const result = await run({}, {
      remoteUrl: 'https://github.com/owner/project',
    })
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.owner).toBe('owner')
      expect(result.right.repo).toBe('project')
    }
  })

  test('GITHUB_REPOSITORY takes priority over git remote', async () => {
    const result = await run(
      { GITHUB_REPOSITORY: 'env-org/env-repo' },
      { remoteUrl: 'git@github.com:git-org/git-repo.git' },
    )
    expect(Either.isRight(result)).toBe(true)
    if (Either.isRight(result)) {
      expect(result.right.owner).toBe('env-org')
      expect(result.right.repo).toBe('env-repo')
      expect(result.right.source).toBe('env:GITHUB_REPOSITORY')
    }
  })

  test('invalid GITHUB_REPOSITORY format fails', async () => {
    const result = await run({ GITHUB_REPOSITORY: 'no-slash' })
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe('ExplorerError')
    }
  })

  test('non-github remote fails', async () => {
    const result = await run({}, {
      remoteUrl: 'git@gitlab.com:org/repo.git',
    })
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe('ExplorerError')
      expect(result.left.context.detail).toContain('Could not resolve GitHub repository')
    }
  })
})
