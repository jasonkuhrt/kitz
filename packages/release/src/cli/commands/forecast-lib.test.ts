import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Effect, Option } from 'effect'
import { describe, expect, test } from 'bun:test'
import * as Api from '../../api/__.js'
import { Analysis, Impact, makeCascadeCommit } from '../../api/analyzer/models/__.js'
import { makeHarness } from '../../api/executor/test-support.js'
import { noPackagesFoundMessage } from './command-workspace.js'
import { buildForecastInput, loadForecastInputFromFile } from './forecast-lib.js'

const makeResolvedConfig = (
  publishing: Api.Config.ResolvedConfig['publishing'] = Api.Publishing.defaultPublishing(),
): Api.Config.ResolvedConfig =>
  Api.Config.ResolvedConfig.make({
    trunk: 'main',
    npmTag: 'latest',
    candidateTag: 'next',
    packages: {},
    publishing,
    operator: Api.Operator.ResolvedOperator.make({
      manager: Pkg.Manager.DetectedPackageManager.make({
        name: 'bun',
        source: 'runtime',
      }),
      releaseCommand: 'bun run release',
      prepareCommands: [],
    }),
    resolvedConventionalCommitTypes: Api.Config.resolveConventionalCommitTypes({}),
    commitOverrides: {},
    lint: Api.Lint.resolveConfig({}),
  })

const workspacePackage = (scope: string) => ({
  scope,
  name: Pkg.Moniker.parse(`@kitz/${scope}`),
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const makeForecast = (headSha = 'abc1234') =>
  Api.Forecaster.Forecast.make({
    owner: 'jasonkuhrt',
    repo: 'kitz',
    branch: 'main',
    headSha,
    releases: [],
    cascades: [],
  })

const makeRecon = (): Api.Explorer.Recon => ({
  ci: { detected: false, provider: null, prNumber: null },
  github: {
    target: { owner: 'jasonkuhrt', repo: 'kitz', source: 'git:origin' },
    credentials: null,
  },
  npm: { authenticated: false, username: null, registry: null },
  git: {
    root: Fs.Path.AbsDir.fromString('/repo/'),
    clean: true,
    branch: 'main',
    headSha: 'abc1234',
    remotes: {},
  },
})

const packageJson = (scope: string, fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: `@kitz/${scope}`,
    version: '0.0.0-kitz-release',
    ...fields,
  })

describe('forecast-lib', () => {
  test('returns an empty idle forecast when no packages are configured', async () => {
    const logs: string[] = []

    const result = await Effect.runPromise(
      buildForecastInput({
        loadWorkspace: Effect.succeed({
          _tag: 'EmptyCommandWorkspace',
          config: makeResolvedConfig(),
        }),
        tags: Effect.die('tags should not be read'),
        analyze: (() => Effect.die('analysis should not run')) as typeof Api.Analyzer.analyze,
        explore: Effect.die('explore should not run'),
        forecast: (() => {
          throw new Error('forecast should not run')
        }) as typeof Api.Forecaster.forecast,
        log: (message) =>
          Effect.sync(() => {
            logs.push(message)
          }),
      }),
    )

    expect(logs).toEqual([noPackagesFoundMessage])
    expect(result.forecast.releases).toEqual([])
    expect(result.forecast.cascades).toEqual([])
    expect(result.publishState).toBe('idle')
    expect(result.publishHistory).toEqual([])
    expect(result.interactiveChecklist).toBe(false)
  })

  test('builds forecast input from analyzed workspace packages', async () => {
    const pkg = workspacePackage('core')
    const tags = ['@kitz/core@1.0.0']
    const analysis = { _tag: 'Analysis' } as any
    const recon = { _tag: 'Recon' } as any
    const forecast = makeForecast()
    let analysisInput: Parameters<typeof Api.Analyzer.analyze>[0] | undefined
    let forecastArgs:
      | {
          readonly analysis: unknown
          readonly recon: unknown
        }
      | undefined

    const result = await Effect.runPromise(
      buildForecastInput({
        loadWorkspace: Effect.succeed({
          _tag: 'ReadyCommandWorkspace',
          config: makeResolvedConfig(
            Api.Publishing.Publishing.make({
              official: { mode: 'manual' },
              candidate: { mode: 'manual' },
              ephemeral: {
                mode: 'github-token',
                workflow: '.github/workflows/release.yml',
                tokenEnv: 'NPM_TOKEN',
              },
            }),
          ),
          packages: [pkg],
        }),
        tags: Effect.succeed(tags),
        analyze: ((input) => {
          analysisInput = input
          return Effect.succeed(analysis)
        }) as typeof Api.Analyzer.analyze,
        explore: Effect.succeed(recon),
        forecast: ((receivedAnalysis, receivedRecon) => {
          forecastArgs = {
            analysis: receivedAnalysis,
            recon: receivedRecon,
          }
          return forecast
        }) as typeof Api.Forecaster.forecast,
        log: () => Effect.void,
      }),
    )

    expect(analysisInput).toEqual({
      packages: [pkg],
      tags,
      resolvedConventionalCommitTypes: Api.Config.resolveConventionalCommitTypes({}),
      commitOverrides: {},
    })
    expect(forecastArgs).toEqual({
      analysis,
      recon,
    })
    expect(result.forecast).toEqual(forecast)
    expect(result.publishState).toBe('idle')
    expect(result.publishHistory).toEqual([])
    expect(result.interactiveChecklist).toBe(true)
  })

  test('includes runtime dependency closure cascades from official planning', async () => {
    const appPackage = workspacePackage('app')
    const platformPackage = workspacePackage('platform')
    const docsPackage = workspacePackage('docs')
    const analysis = Analysis.make({
      impacts: [
        Impact.make({
          package: appPackage,
          bump: 'patch',
          commits: [makeCascadeCommit('app', 'fix')],
          currentVersion: Option.none(),
        }),
      ],
      cascades: [],
      unchanged: [platformPackage, docsPackage],
      tags: [],
    })

    const result = await Effect.runPromise(
      buildForecastInput({
        loadWorkspace: Effect.succeed({
          _tag: 'ReadyCommandWorkspace',
          config: makeResolvedConfig(),
          packages: [appPackage, platformPackage, docsPackage],
        }),
        tags: Effect.succeed([]),
        analyze: (() => Effect.succeed(analysis)) as typeof Api.Analyzer.analyze,
        explore: Effect.succeed(makeRecon()),
        log: () => Effect.void,
      }).pipe(
        Effect.provide(
          Fs.Memory.layer({
            '/repo/packages/app/package.json': packageJson('app', {
              dependencies: {
                '@kitz/platform': 'workspace:*',
              },
            }),
            '/repo/packages/platform/package.json': packageJson('platform'),
            '/repo/packages/docs/package.json': packageJson('docs'),
          }),
        ),
      ),
    )

    expect(result.forecast.releases.map((item) => item.packageName)).toEqual(['@kitz/app'])
    expect(result.forecast.cascades.map((item) => item.packageName)).toEqual(['@kitz/platform'])
  })

  test('falls back to git tags when custom tag loading is not provided', async () => {
    const harness = await Effect.runPromise(
      makeHarness({
        git: {
          root: '/repo',
          tags: ['@kitz/core@1.2.3'],
          commits: [],
          isClean: true,
        },
        diskLayout: {},
      }),
    )
    const pkg = workspacePackage('core')
    const analysis = { _tag: 'Analysis' } as any
    const recon = { _tag: 'Recon' } as any
    const forecast = makeForecast()
    let analysisInput: Parameters<typeof Api.Analyzer.analyze>[0] | undefined

    const result = await Effect.runPromise(
      buildForecastInput({
        loadWorkspace: Effect.succeed({
          _tag: 'ReadyCommandWorkspace',
          config: makeResolvedConfig(),
          packages: [pkg],
        }),
        analyze: ((input) => {
          analysisInput = input
          return Effect.succeed(analysis)
        }) as typeof Api.Analyzer.analyze,
        explore: Effect.succeed(recon),
        forecast: (() => forecast) as typeof Api.Forecaster.forecast,
        log: () => Effect.void,
      } as any).pipe(Effect.provide(harness.workflowLayer)),
    )

    expect(analysisInput?.tags).toEqual(['@kitz/core@1.2.3'])
    expect(result.interactiveChecklist).toBe(false)
  })

  test('loads a saved forecast envelope from disk', async () => {
    const harness = await Effect.runPromise(
      makeHarness({
        git: { root: '/repo', tags: [], commits: [], isClean: true },
        diskLayout: {
          '/tmp/forecast.json': Api.Forecaster.encodeForecastEnvelope({
            forecast: makeForecast(),
            publishState: 'published',
            publishHistory: [
              {
                package: '@kitz/core',
                version: '0.1.0',
                iteration: 1,
                sha: 'abc1234',
                timestamp: '2026-04-03T00:00:00.000Z',
                runId: 'run-1',
              },
            ],
          }),
        },
      }),
    )

    const result = await Effect.runPromise(
      loadForecastInputFromFile('/tmp/forecast.json').pipe(Effect.provide(harness.workflowLayer)),
    )

    expect(result.forecast.owner).toBe('jasonkuhrt')
    expect(result.publishState).toBe('published')
    expect(result.publishHistory[0]?.package).toBe('@kitz/core')
  })

  test('loads raw forecast JSON from disk', async () => {
    const harness = await Effect.runPromise(
      makeHarness({
        git: { root: '/repo', tags: [], commits: [], isClean: true },
        diskLayout: {
          '/tmp/raw-forecast.json': JSON.stringify(
            Api.Forecaster.Forecast.encodeSync(makeForecast('def5678')),
          ),
        },
      }),
    )

    const result = await Effect.runPromise(
      loadForecastInputFromFile('/tmp/raw-forecast.json').pipe(
        Effect.provide(harness.workflowLayer),
      ),
    )

    expect(result.forecast.headSha).toBe('def5678')
    expect(result.publishState).toBe('idle')
    expect(result.publishHistory).toEqual([])
  })
})
