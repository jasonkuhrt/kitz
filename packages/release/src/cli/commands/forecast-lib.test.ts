import { Console, Effect, Layer, Option } from 'effect'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { describe, expect, test } from 'bun:test'
import * as Api from '../../api/__.js'
import { Analysis, Impact, makeCascadeCommit } from '../../api/analyzer/models/__.js'
import { makeHarness } from '../../api/executor/test-support.js'
import { testConfig } from '../../test-support.js'
import { noPackagesFoundMessage } from './command-workspace.js'
import {
  ForecastData,
  type ForecastDataShape,
  buildForecastInput,
  buildForecastWithCascades,
  loadForecastInputFromFile,
  makeForecastData,
} from './forecast-lib.js'

const makeResolvedConfig = (
  publishing: Api.Config.ResolvedConfig['publishing'] = Api.Publishing.defaultPublishing(),
): Api.Config.ResolvedConfig => testConfig({ publishing })

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

const emptyAnalysis = Analysis.make({
  impacts: [],
  cascades: [],
  unchanged: [],
  tags: [],
})

const packageJson = (scope: string, fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: `@kitz/${scope}`,
    version: '0.0.0-kitz-release',
    ...fields,
  })

/** Stub layer builder: all seams die unless overridden. */
const forecastDataLayer = (overrides: Partial<ForecastDataShape>): Layer.Layer<ForecastData> =>
  Layer.succeed(ForecastData)({
    loadWorkspace: Effect.die('loadWorkspace should not run'),
    tags: Effect.die('tags should not be read'),
    analyze: () => Effect.die('analysis should not run'),
    explore: Effect.die('explore should not run'),
    forecast: () => Effect.die('forecast should not run'),
    ...overrides,
  })

const captureConsole = (logs: string[]) => ({
  ...globalThis.console,
  log: (...args: ReadonlyArray<unknown>) => {
    logs.push(args.join(' '))
  },
})

describe('forecast-lib', () => {
  test('returns an empty idle forecast when no packages are configured', async () => {
    const logs: string[] = []

    const result = await Effect.runPromise(
      buildForecastInput().pipe(
        Effect.provide(
          forecastDataLayer({
            loadWorkspace: Effect.succeed({
              _tag: 'EmptyCommandWorkspace',
              config: makeResolvedConfig(),
            }),
          }),
        ),
        Effect.provideService(Console.Console, captureConsole(logs)),
      ),
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
    const recon = makeRecon()
    const forecast = makeForecast()
    let analysisInput: Parameters<typeof Api.Analyzer.analyze>[0] | undefined
    let forecastArgs:
      | {
          readonly analysis: unknown
          readonly recon: unknown
        }
      | undefined

    const result = await Effect.runPromise(
      buildForecastInput().pipe(
        Effect.provide(
          forecastDataLayer({
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
            analyze: (input) => {
              analysisInput = input
              return Effect.succeed(emptyAnalysis)
            },
            explore: Effect.succeed(recon),
            forecast: (params) => {
              forecastArgs = {
                analysis: params.analysis,
                recon: params.recon,
              }
              return Effect.succeed(forecast)
            },
          }),
        ),
      ),
    )

    expect(analysisInput).toEqual({
      packages: [pkg],
      tags,
      resolvedConventionalCommitTypes: Api.Config.resolveConventionalCommitTypes({}),
      commitOverrides: {},
    })
    expect(forecastArgs).toEqual({
      analysis: emptyAnalysis,
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
    const fsLayer = Fs.Memory.layer({
      '/repo/packages/app/package.json': packageJson('app', {
        dependencies: {
          '@kitz/platform': 'workspace:*',
        },
      }),
      '/repo/packages/platform/package.json': packageJson('platform'),
      '/repo/packages/docs/package.json': packageJson('docs'),
    })

    const result = await Effect.runPromise(
      buildForecastInput().pipe(
        Effect.provide(
          forecastDataLayer({
            loadWorkspace: Effect.succeed({
              _tag: 'ReadyCommandWorkspace',
              config: makeResolvedConfig(),
              packages: [appPackage, platformPackage, docsPackage],
            }),
            tags: Effect.succeed([]),
            analyze: () => Effect.succeed(analysis),
            explore: Effect.succeed(makeRecon()),
            // The REAL forecast projection (cascade fold) over a memory fs.
            forecast: (params) => buildForecastWithCascades(params).pipe(Effect.provide(fsLayer)),
          }),
        ),
      ),
    )

    expect(result.forecast.releases.map((item) => item.packageName)).toEqual(['@kitz/app'])
    expect(result.forecast.cascades.map((item) => item.packageName)).toEqual(['@kitz/platform'])
  })

  test('live ForecastData reads git tags through the harness services', async () => {
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
    const recon = makeRecon()
    const forecast = makeForecast()
    let analysisInput: Parameters<typeof Api.Analyzer.analyze>[0] | undefined

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        // Build the LIVE implementation against harness services, then
        // override the seams that would hit the network/registry.
        const live = yield* makeForecastData
        return yield* buildForecastInput().pipe(
          Effect.provideService(ForecastData, {
            ...live,
            loadWorkspace: Effect.succeed({
              _tag: 'ReadyCommandWorkspace' as const,
              config: makeResolvedConfig(),
              packages: [pkg],
            }),
            analyze: (input) => {
              analysisInput = input
              return Effect.succeed(emptyAnalysis)
            },
            explore: Effect.succeed(recon),
            forecast: () => Effect.succeed(forecast),
          }),
        )
      }).pipe(Effect.provide(harness.workflowLayer)),
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
