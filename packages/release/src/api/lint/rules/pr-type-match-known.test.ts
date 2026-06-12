import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import { resolveConventionalCommitTypes } from '../../config.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { ConventionalCommitSettingsService } from '../services/conventional-commit-settings.js'
import { PrService } from '../services/pr.js'
import { rule } from './pr-type-match-known.js'

const makePrLayer = (title: string, commit: CC.Commit.Commit) =>
  Layer.succeed(PrService, {
    number: 129,
    title,
    body: '',
    commit: Option.some(commit),
    titleParseError: Option.none(),
  })

const defaultSettingsLayer = Layer.succeed(ConventionalCommitSettingsService, {
  resolvedTypes: resolveConventionalCommitTypes({}),
})

describe('pr.type.match-known', () => {
  test('passes when every target type is standard', async () => {
    const result = await Effect.runPromise(
      rule.check().pipe(
        Effect.provide(
          Layer.mergeAll(
            makePrLayer(
              'feat(core), fix(cli): polish release flow',
              new CC.Commit.Multi({
                targets: [
                  new CC.Target({ type: CC.Type.parse('feat'), scope: 'core', breaking: false }),
                  new CC.Target({ type: CC.Type.parse('fix'), scope: 'cli', breaking: false }),
                ],
                message: 'polish release flow',
                summary: Option.none(),
                sections: {},
              }),
            ),
            defaultSettingsLayer,
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('violates when a type is not in the resolved types', async () => {
    const result = await Effect.runPromise(
      rule.check().pipe(
        Effect.provide(
          Layer.mergeAll(
            makePrLayer(
              'feat(core), wip(cli): polish release flow',
              new CC.Commit.Multi({
                targets: [
                  new CC.Target({ type: CC.Type.parse('feat'), scope: 'core', breaking: false }),
                  new CC.Target({ type: CC.Type.parse('wip'), scope: 'cli', breaking: false }),
                ],
                message: 'polish release flow',
                summary: Option.none(),
                sections: {},
              }),
            ),
            defaultSettingsLayer,
          ),
        ),
      ),
    )

    expect(result).toBeDefined()
    expect(Violation.is(result)).toBe(true)
    if (!Violation.is(result)) throw new Error('expected violation')
    expect(PrTitle.is(result.location)).toBe(true)
    expect(result.summary).toContain('wip')
  })

  test('passes when a custom type is configured in resolved types', async () => {
    const result = await Effect.runPromise(
      rule.check().pipe(
        Effect.provide(
          Layer.mergeAll(
            makePrLayer(
              'deps(core): bump lodash',
              new CC.Commit.Single({
                type: CC.Type.parse('deps'),
                scopes: ['core'],
                breaking: false,
                message: 'bump lodash',
                body: Option.none(),
                footers: [],
              }),
            ),
            Layer.succeed(ConventionalCommitSettingsService, {
              resolvedTypes: resolveConventionalCommitTypes({ deps: 'patch' }),
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('passes when a custom type is configured with no release impact', async () => {
    const result = await Effect.runPromise(
      rule.check().pipe(
        Effect.provide(
          Layer.mergeAll(
            makePrLayer(
              'tests(core): add property tests',
              new CC.Commit.Single({
                type: CC.Type.parse('tests'),
                scopes: ['core'],
                breaking: false,
                message: 'add property tests',
                body: Option.none(),
                footers: [],
              }),
            ),
            Layer.succeed(ConventionalCommitSettingsService, {
              resolvedTypes: resolveConventionalCommitTypes({ tests: null }),
            }),
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })

  test('passes when a standard no-release type has no configured impact', async () => {
    const result = await Effect.runPromise(
      rule.check().pipe(
        Effect.provide(
          Layer.mergeAll(
            makePrLayer(
              'chore(release): ignore session dirs',
              new CC.Commit.Single({
                type: CC.Type.parse('chore'),
                scopes: ['release'],
                breaking: false,
                message: 'ignore session dirs',
                body: Option.none(),
                footers: [],
              }),
            ),
            defaultSettingsLayer,
          ),
        ),
      ),
    )

    expect(result).toBeUndefined()
  })
})
