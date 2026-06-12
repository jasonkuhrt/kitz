import { ConventionalCommits as CC } from '@kitz/conventional-commits'
import { ChildProcessSpawner } from 'effect/unstable/process'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Effect, Layer, Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import { resolveConfig } from '../models/config.js'
import { Failed, Finished } from '../models/report.js'
import {
  ConventionalCommitSettings,
  DefaultDiffLayer,
  DefaultGitHubLayer,
  DefaultMonorepoLayer,
  Preconditions,
  PrService,
  ReleaseContext,
  ReleasePlan,
} from '../services/__.js'
import { check, PreconditionsNotMetError } from './check.js'

const prLayer = Layer.succeed(PrService, {
  number: 129,
  title: 'feat: missing scope',
  body: '',
  commit: Option.some(
    new CC.Commit.Single({
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

const spawnerLayer = Layer.succeed(
  ChildProcessSpawner.ChildProcessSpawner,
  ChildProcessSpawner.make(() => Effect.die('command execution not expected in this test') as any),
)

const envLayer = Env.Test({ cwd: Fs.Path.AbsDir.fromString('/repo/') })
const fsLayer = Fs.Memory.layer({})
const gitLayer = Git.Memory.make({})

const makeBaseLayer = (preconditions: Layer.Layer<never> | ReturnType<typeof Preconditions.make>) =>
  Layer.mergeAll(
    ConventionalCommitSettings.DefaultConventionalCommitSettingsLayer,
    DefaultDiffLayer,
    DefaultGitHubLayer,
    DefaultMonorepoLayer,
    ReleaseContext.DefaultReleaseContextLayer,
    ReleasePlan.DefaultReleasePlanLayer,
    preconditions,
    prLayer,
    spawnerLayer,
    envLayer,
    fsLayer,
    gitLayer,
  )

describe('check', () => {
  test('onlyRules can force-run rules that default to disabled', async () => {
    const report = await Effect.runPromise(
      check({
        config: resolveConfig({
          onlyRules: ['pr.scope.require'],
        }),
      }).pipe(Effect.provide(makeBaseLayer(Preconditions.make({ hasOpenPR: true })))),
    )

    const result = report.results.find((entry) => entry.rule.id === 'pr.scope.require')
    expect(result).toBeDefined()
    expect(result && Finished.is(result)).toBe(true)

    if (!result || !Finished.is(result)) {
      throw new Error('expected a finished pr.scope.require result')
    }

    expect(result.violation).toBeDefined()
  })

  // Regression: this used to store an untyped `new Error('Preconditions not met: ...')`.
  test('explicitly-requested rules with unmet preconditions fail with PreconditionsNotMetError', async () => {
    const report = await Effect.runPromise(
      check({
        config: resolveConfig({
          onlyRules: ['pr.scope.require'],
        }),
      }).pipe(Effect.provide(makeBaseLayer(Preconditions.make({})))),
    )

    const result = report.results.find((entry) => entry.rule.id === 'pr.scope.require')
    expect(result).toBeDefined()
    expect(result && Failed.is(result)).toBe(true)

    if (!result || !Failed.is(result)) {
      throw new Error('expected a failed pr.scope.require result')
    }

    expect(result.error).toBeInstanceOf(PreconditionsNotMetError)
    if (!(result.error instanceof PreconditionsNotMetError)) {
      throw new Error('expected a PreconditionsNotMetError')
    }

    expect(result.error.context.ruleId).toBe<string>('pr.scope.require')
    expect(result.error.context.failed).toEqual(['hasOpenPR'])
    expect(result.error.message).toBe('Preconditions not met for pr.scope.require: hasOpenPR')
  })
})
