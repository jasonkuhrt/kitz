/**
 * @module cli/commands/forecast-lib
 *
 * Decision logic behind `release forecast`: assembling the forecast input
 * from the workspace, analyzer, and environmental recon. Data seams are
 * expressed as the {@link ForecastData} Effect service; tests provide stub
 * layers instead of hand-rolled dependency records.
 */
import { Git } from '@kitz/git'
import {
  Console,
  Context,
  Effect,
  FileSystem,
  HashSet,
  Layer,
  Option,
  Result,
  Schema,
} from 'effect'
import * as Analyzer from '../../api/analyzer/__.js'
import * as Commentator from '../../api/commentator/__.js'
import * as Explorer from '../../api/explorer/__.js'
import * as Forecaster from '../../api/forecaster/__.js'
import * as Planner from '../../api/planner/__.js'
import { Analysis, CascadeImpact } from '../../api/analyzer/models/__.js'
import { ChildProcessSpawnerLayer, ServicesLayer } from '../../platform.js'
import { CommandBaseLayer, NpmCliLayer } from './_shared.js'
import {
  type CommandWorkspace,
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'

export interface ForecastInput {
  readonly forecast: Forecaster.Forecast
  readonly publishState: Commentator.PublishState
  readonly publishHistory: readonly Commentator.PublishRecord[]
  readonly interactiveChecklist: boolean
}

// ─── ForecastData service ────────────────────────────────────────────

export interface ForecastDataShape {
  readonly loadWorkspace: Effect.Effect<CommandWorkspace, Error>
  readonly tags: Effect.Effect<readonly string[], Error>
  readonly analyze: (
    params: Parameters<typeof Analyzer.analyze>[0],
  ) => Effect.Effect<Analyzer.Models.Analysis, Error>
  readonly explore: Effect.Effect<Explorer.Recon, Error>
  /**
   * Render the forecast for an analysis. The live implementation folds
   * official-plan dependency cascades into the analysis before forecasting.
   */
  readonly forecast: (params: {
    readonly analysis: Analyzer.Models.Analysis
    readonly packages: readonly Analyzer.Workspace.Package[]
    readonly recon: Explorer.Recon
  }) => Effect.Effect<Forecaster.Forecast, Error>
}

/**
 * Data seams of the forecast pipeline. {@link ForecastDataLive} wires the
 * real workspace/git/analyzer/explorer; tests provide stub layers.
 */
export class ForecastData extends Context.Service<ForecastData, ForecastDataShape>()(
  '@kitz/release/cli/ForecastData',
) {}

/** The live forecast projection (exported for tests exercising the real cascade fold). */
export const buildForecastWithCascades = (params: {
  readonly analysis: Analyzer.Models.Analysis
  readonly packages: readonly Analyzer.Workspace.Package[]
  readonly recon: Explorer.Recon
}) =>
  addOfficialPlanCascades(params.analysis, params.packages).pipe(
    Effect.flatMap(
      (analysis): Effect.Effect<Forecaster.Forecast, Error> =>
        Forecaster.hasGithubTarget(params.recon)
          ? Result.match(Forecaster.forecast(analysis, params.recon), {
              onFailure: Effect.fail,
              onSuccess: Effect.succeed,
            })
          : Effect.fail(
              new Explorer.ExplorerError({
                context: {
                  detail: 'no GitHub repository target was resolved from the git remote',
                },
              }),
            ),
    ),
  )

type ForecastDataRequirements =
  | Effect.Services<ReturnType<typeof loadCommandWorkspace>>
  | Effect.Services<ReturnType<typeof Analyzer.analyze>>
  | Effect.Services<ReturnType<typeof Explorer.explore>>
  | Effect.Services<ReturnType<typeof buildForecastWithCascades>>
  | Git.Git

/** Build the live {@link ForecastData} implementation, capturing required services. */
export const makeForecastData: Effect.Effect<ForecastDataShape, never, ForecastDataRequirements> =
  Effect.gen(function* () {
    const services = yield* Effect.context<ForecastDataRequirements>()
    return {
      loadWorkspace: Effect.provideContext(loadCommandWorkspace(), services),
      tags: Effect.provideContext(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getTags()
        }),
        services,
      ),
      analyze: (params) => Effect.provideContext(Analyzer.analyze(params), services),
      explore: Effect.provideContext(Explorer.explore(), services),
      forecast: (params) => Effect.provideContext(buildForecastWithCascades(params), services),
    }
  })

export const ForecastDataLive = Layer.effect(ForecastData, makeForecastData)

// ─── Forecast input assembly ─────────────────────────────────────────

const emptyForecastInput: ForecastInput = {
  forecast: Forecaster.Forecast.make({
    owner: '',
    repo: '',
    branch: '',
    headSha: '',
    releases: [],
    cascades: [],
  }),
  publishState: 'idle',
  publishHistory: [],
  interactiveChecklist: false,
}

export const buildForecastInput = (): Effect.Effect<ForecastInput, Error, ForecastData> =>
  Effect.gen(function* () {
    const data = yield* ForecastData
    const workspace = yield* data.loadWorkspace
    if (!isReadyCommandWorkspace(workspace)) {
      yield* Console.log(noPackagesFoundMessage)
      return emptyForecastInput
    }
    const { config, packages } = workspace

    const tags = yield* data.tags
    const analysis = yield* data.analyze({
      packages,
      tags,
      resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
      commitOverrides: config.commitOverrides,
    })
    const recon = yield* data.explore
    const forecast = yield* data.forecast({ analysis, packages, recon })

    return {
      forecast,
      publishState: 'idle' as const,
      publishHistory: [],
      interactiveChecklist: (config.publishing.ephemeral ?? { mode: 'manual' }).mode !== 'manual',
    }
  })

export const addOfficialPlanCascades = (
  analysis: Analysis,
  packages: readonly Analyzer.Workspace.Package[],
): Effect.Effect<Analysis, Error, Effect.Services<ReturnType<typeof Planner.official>>> =>
  Effect.gen(function* () {
    return withOfficialPlanCascades(analysis, yield* Planner.official(analysis, { packages }))
  })

const withOfficialPlanCascades = (
  analysis: Analysis,
  plan: Planner.PlanOf<'official'>,
): Analysis => {
  const existingCascadeNames = HashSet.fromIterable(
    analysis.cascades.map((cascade) => cascade.package.name.moniker),
  )
  const planOnlyCascades = plan.cascades.filter(
    (cascade) => !HashSet.has(existingCascadeNames, cascade.package.name.moniker),
  )

  if (planOnlyCascades.length === 0) return analysis

  return Analysis.make({
    impacts: analysis.impacts,
    cascades: [
      ...analysis.cascades,
      ...planOnlyCascades.map((cascade) =>
        CascadeImpact.make({
          package: cascade.package,
          currentVersion: cascade.currentVersion,
          triggeredBy: [],
        }),
      ),
    ],
    unchanged: analysis.unchanged,
    tags: analysis.tags,
  })
}

export const loadForecastInputFromFile = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const jsonText = yield* fs.readFileString(filePath)
    const envelope = yield* Schema.decodeUnknownEffect(Forecaster.ForecastEnvelopeJson)(
      jsonText,
    ).pipe(Effect.option)

    if (Option.isSome(envelope)) {
      return {
        forecast: envelope.value.forecast,
        publishState: envelope.value.publishState,
        publishHistory: envelope.value.publishHistory,
        interactiveChecklist: false,
      } satisfies ForecastInput
    }

    return {
      forecast: yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Forecaster.Forecast))(
        jsonText,
      ),
      publishState: 'idle' as const,
      publishHistory: [],
      interactiveChecklist: false,
    } satisfies ForecastInput
  })

const ForecastBaseLayer = Layer.mergeAll(
  CommandBaseLayer,
  ServicesLayer,
  Git.GitLive,
  ChildProcessSpawnerLayer,
  NpmCliLayer,
)

export const ForecastCommandLayer = Layer.mergeAll(
  ForecastBaseLayer,
  ForecastDataLive.pipe(Layer.provide(ForecastBaseLayer)),
)
