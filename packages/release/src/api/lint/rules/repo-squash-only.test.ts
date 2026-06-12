import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Violation } from '../models/violation.js'
import { type GitHub, GitHubService } from '../services/github.js'
import { rule } from './repo-squash-only.js'

const githubLayer = (settings: GitHub['settings']) => Layer.succeed(GitHubService, { settings })

describe('repo.squash-only', () => {
  test('passes when only squash merge is enabled', async () => {
    const result = await Effect.runPromise(
      rule.check().pipe(
        Effect.provide(
          githubLayer({
            allowSquashMerge: true,
            allowMergeCommit: false,
            allowRebaseMerge: false,
          }),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('violates with the current merge settings in the detail', async () => {
    const result = await Effect.runPromise(
      rule.check().pipe(
        Effect.provide(
          githubLayer({
            allowSquashMerge: true,
            allowMergeCommit: true,
            allowRebaseMerge: false,
          }),
        ),
      ),
    )

    expect(Violation.is(result)).toBe(true)
    if (!Violation.is(result)) throw new Error('expected a violation')

    expect(result.location._tag).toBe('ViolationLocationRepoSettings')
    expect(result.summary).toBe('Repository merge settings are not squash-only.')
    expect(result.detail).toContain('squash merge: enabled')
    expect(result.detail).toContain('merge commit: enabled')
    expect(result.detail).toContain('rebase merge: disabled')
  })
})
