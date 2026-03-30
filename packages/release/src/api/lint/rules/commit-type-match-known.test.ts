import { Git } from '@kitz/git'
import type { Semver } from '@kitz/semver'
import { Effect, Layer } from 'effect'
import { describe, expect, test } from 'vitest'
import { resolveConventionalCommitTypes } from '../../config.js'
import { GitHistory } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { ConventionalCommitSettingsService } from '../services/conventional-commit-settings.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { rule } from './commit-type-match-known.js'

const defaultTypes = resolveConventionalCommitTypes({})

const makeSettingsLayer = (resolvedTypes: Record<string, Semver.BumpType> = defaultTypes) =>
  Layer.succeed(ConventionalCommitSettingsService, { resolvedTypes })

const emptyOptionsLayer = Layer.succeed(RuleOptionsService, {})

describe('commit.type.match-known', () => {
  test('passes when all commits use recognized types', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer(),
            emptyOptionsLayer,
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
      rule.check.pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer(),
            emptyOptionsLayer,
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
      rule.check.pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer({ ...defaultTypes, deps: 'patch' }),
            emptyOptionsLayer,
            Git.Memory.make({
              commits: [
                Git.Memory.commit('deps(core): bump lodash'),
              ],
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('skips non-conventional commits without violating', async () => {
    const result = await Effect.runPromise(
      rule.check.pipe(
        Effect.provide(
          Layer.mergeAll(
            makeSettingsLayer(),
            emptyOptionsLayer,
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
