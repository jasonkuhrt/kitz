import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { resolveConfig } from '../models/config.js'
import { Finished } from '../models/report.js'
import {
  DefaultDiffLayer,
  DefaultGitHubLayer,
  DefaultMonorepoLayer,
  Preconditions,
  PrService,
  ReleaseContext,
} from '../services/__.js'
import { check } from './check.js'

const prLayer = Layer.succeed(PrService, {
  number: 129,
  title: 'feat: missing scope',
  body: '',
  commit: Option.some(
    CC.Commit.Single.make({
      type: CC.Type.parse('feat'),
      scopes: [],
      breaking: false,
      message: 'missing scope',
      body: Option.none(),
      footers: [],
    }),
  ),
  titleParseError: Option.none(),
})

describe('check', () => {
  test('onlyRules can force-run rules that default to disabled', async () => {
    const report = await Effect.runPromise(
      check({
        config: resolveConfig({
          onlyRules: ['pr.scope.require'],
        }),
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            DefaultDiffLayer,
            DefaultGitHubLayer,
            DefaultMonorepoLayer,
            ReleaseContext.DefaultReleaseContextLayer,
            Preconditions.make({ hasOpenPR: true }),
            prLayer,
          ),
        ),
      ),
    )

    const result = report.results.find((entry) => entry.rule.id === 'pr.scope.require')
    expect(result).toBeDefined()
    expect(result && Finished.is(result)).toBe(true)

    if (!result || !Finished.is(result)) {
      throw new Error('expected a finished pr.scope.require result')
    }

    expect(result.violation).toBeDefined()
  })
})
