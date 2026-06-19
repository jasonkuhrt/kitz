import { FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Console, Effect, Layer, Option, Schema } from 'effect'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, ServicesLayer, FileSystemLayer } from '../../platform.js'
import {
  type CommandWorkspace,
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'

export interface ForecastInput {
  readonly forecast: Api.Forecaster.Forecast
  readonly publishState: Api.Commentator.PublishState
  readonly publishHistory: readonly Api.Commentator.PublishRecord[]
  readonly interactiveChecklist: boolean
}

export interface BuildForecastInputDependencies {
  readonly loadWorkspace: Effect.Effect<CommandWorkspace, Error>
  readonly tags: Effect.Effect<readonly string[], Error>
  readonly analyze: typeof Api.Analyzer.analyze
  readonly explore: Effect.Effect<any, Error>
  readonly forecast: typeof Api.Forecaster.forecast
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
  const analyze = dependencies?.analyze ?? Api.Analyzer.analyze
  const explore = dependencies?.explore ?? Api.Explorer.explore()
  const forecast = dependencies?.forecast ?? Api.Forecaster.forecast
  const log = dependencies?.log ?? Console.log

  return Effect.gen(function* () {
    const workspace = yield* loadWorkspace
    if (!isReadyCommandWorkspace(workspace)) {
      yield* log(noPackagesFoundMessage)
      return {
        forecast: Api.Forecaster.Forecast.make({
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
    })
    const recon = yield* explore
    const renderedForecast = forecast(analysis, recon)

    return {
      forecast: renderedForecast,
      publishState: 'idle' as const,
      publishHistory: [],
      interactiveChecklist: (config.publishing.ephemeral ?? { mode: 'manual' }).mode !== 'manual',
    }
  })
}

export const loadForecastInputFromFile = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const jsonText = yield* fs.readFileString(filePath)
    const envelope = yield* Schema.decodeUnknownEffect(Api.Forecaster.ForecastEnvelopeJson)(
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
      forecast: yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Api.Forecaster.Forecast))(
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
