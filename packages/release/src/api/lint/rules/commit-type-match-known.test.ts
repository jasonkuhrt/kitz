import { Git } from '@kitz/git'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'bun:test'
import { resolveConventionalCommitTypes } from '../../config.js'
import { GitHistory } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { ConventionalCommitSettingsService } from '../services/conventional-commit-settings.js'
import { rule } from './commit-type-match-known.js'

const defaultTypes = resolveConventionalCommitTypes({})

const makeSettingsLayer = (resolvedTypes = defaultTypes) =>
  Layer.succeed(ConventionalCommitSettingsService, { resolvedTypes })

describe('commit.type.match-known', () => {
  test('passes when all commits use recognized types', async () => {
    const result = await Effect.runPromise(
      rule.check({}).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer(),
            Git.Memory.make({
              commits: [
                Git.Memory.commit('feat(core): add api'),
                Git.Memory.commit('fix(cli): patch bug'),
              ],
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('violates when a commit uses an unrecognized type', async () => {
    const badHash = Git.Sha.make('bad1234')
    const result = await Effect.runPromise(
      rule.check({}).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer(),
            Git.Memory.make({
              commits: [
                Git.Memory.commit('feat(core): add api'),
                Git.Memory.commit('wip(cli): work in progress', { hash: badHash }),
              ],
            }),
          ),
        ),
      ),
    )

    expect(result).toBeDefined()
    expect(Violation.is(result)).toBe(true)
    if (!Violation.is(result)) throw new Error('expected violation')
    expect(GitHistory.is(result.location)).toBe(true)
    expect(result.summary).toContain('wip')
    expect(result.fix).toBeDefined()
  })

  test('passes when a custom type is configured', async () => {
    const result = await Effect.runPromise(
      rule.check({}).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer({ ...defaultTypes, deps: 'patch' }),
            Git.Memory.make({
              commits: [Git.Memory.commit('deps(core): bump lodash')],
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('passes when a custom type is configured with no release impact', async () => {
    const result = await Effect.runPromise(
      rule.check({}).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer(resolveConventionalCommitTypes({ tests: null })),
            Git.Memory.make({
              commits: [Git.Memory.commit('tests(core): add property tests')],
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('passes when a standard no-release type has no configured impact', async () => {
    const result = await Effect.runPromise(
      rule.check({}).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer(),
            Git.Memory.make({
              commits: [Git.Memory.commit('chore(core): ignore session dirs')],
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('skips non-conventional commits without violating', async () => {
    const result = await Effect.runPromise(
      rule.check({}).pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer(),
            Git.Memory.make({
              commits: [
                Git.Memory.commit('Merge branch main into feature'),
                Git.Memory.commit('feat(core): add api'),
              ],
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })
})
