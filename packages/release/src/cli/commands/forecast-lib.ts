import { FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, HashSet, Layer, Option, Schema } from 'effect'
import * as Analyzer from '../../api/analyzer/__.js'
import * as Commentator from '../../api/commentator/__.js'
import * as Explorer from '../../api/explorer/__.js'
import * as Forecaster from '../../api/forecaster/__.js'
import * as Planner from '../../api/planner/__.js'
import { Analysis, CascadeImpact } from '../../api/analyzer/models/__.js'
import { ChildProcessSpawnerLayer, ServicesLayer, FileSystemLayer } from '../../platform.js'
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

export interface BuildForecastInputDependencies {
  readonly loadWorkspace: Effect.Effect<CommandWorkspace, Error>
  readonly tags: Effect.Effect<readonly string[], Error>
  readonly analyze: typeof Analyzer.analyze
  readonly explore: Effect.Effect<any, Error>
  readonly forecast?: typeof Forecaster.forecast
  readonly log: typeof Console.log
}

export function buildForecastInput(): Effect.Effect<
  ForecastInput,
  Error,
  Env.Env | FileSystem.FileSystem | Git.Git | NpmRegistry.NpmCli
>
export function buildForecastInput(
  dependencies: BuildForecastInputDependencies,
): Effect.Effect<ForecastInput, Error>
export function buildForecastInput(
  dependencies?: BuildForecastInputDependencies,
): Effect.Effect<
  ForecastInput,
  Error,
  Env.Env | FileSystem.FileSystem | Git.Git | NpmRegistry.NpmCli
> {
  const loadWorkspace = dependencies?.loadWorkspace ?? loadCommandWorkspace()
  const tags =
    dependencies?.tags ??
    Effect.gen(function* () {
      const git = yield* Git.Git
      return yield* git.getTags()
    })
  const analyze = dependencies?.analyze ?? Analyzer.analyze
  const explore = dependencies?.explore ?? Explorer.explore()
  const forecast = dependencies?.forecast ?? Forecaster.forecast
  const log = dependencies?.log ?? Console.log

  return Effect.gen(function* () {
    const workspace = yield* loadWorkspace
    if (!isReadyCommandWorkspace(workspace)) {
      yield* log(noPackagesFoundMessage)
      return {
        forecast: Forecaster.Forecast.make({
          owner: '',
          repo: '',
          branch: '',
          headSha: '',
          releases: [],
          cascades: [],
        }),
        publishState: 'idle' as const,
        publishHistory: [],
        interactiveChecklist: false,
      }
    }
    const { config, packages } = workspace

    const resolvedTags = yield* tags
    const analysis = yield* analyze({
      packages,
      tags: resolvedTags,
      resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
      commitOverrides: config.commitOverrides,
    })
    const forecastAnalysis =
      dependencies?.forecast === undefined
        ? yield* addOfficialPlanCascades(analysis, packages)
        : analysis
    const recon = yield* explore
    const renderedForecast = forecast(forecastAnalysis, recon)

    return {
      forecast: renderedForecast,
      publishState: 'idle' as const,
      publishHistory: [],
      interactiveChecklist: (config.publishing.ephemeral ?? { mode: 'manual' }).mode !== 'manual',
    }
  })
}

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

export const ForecastCommandLayer = Layer.mergeAll(
  Env.Live,
  ServicesLayer,
  FileSystemLayer,
  Git.GitLive,
  ChildProcessSpawnerLayer,
  NpmRegistry.NpmCliLive.pipe(Layer.provide(ChildProcessSpawnerLayer)),
)
