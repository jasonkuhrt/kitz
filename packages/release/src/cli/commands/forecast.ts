/**
 * @module cli/commands/forecast
 *
 * Render a read-only release forecast from the current repo or a saved forecast file.
 *
 * Forecasts are lifecycle-agnostic: they always project official versions for human review.
 * Output formats support scan-heavy CLI viewing (`table`, `tree`) and machine exchange (`json`).
 */
import { FileSystem } from 'effect'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Option, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, ServicesLayer, FileSystemLayer } from '../../platform.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Render a release forecast')
  .parameter(
    'format f',
    Schema.UndefinedOr(Schema.Literals(['table', 'tree', 'json']))
      .pipe(
        Schema.decodeTo(Schema.Literals(['table', 'tree', 'json']), {
          decode: SchemaGetter.transform((value) => value ?? 'table'),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(Schema.annotate({ description: 'Output format', default: 'table' })),
  )
  .parameter(
    'from-file',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({
        description: 'Read saved forecast JSON from a file instead of computing from the repo',
      }),
    ),
  )
  .parse()

const spawnerLayer = ChildProcessSpawnerLayer
const npmLayer = NpmRegistry.NpmCliLive.pipe(Layer.provide(spawnerLayer))

Cli.run(
  Layer.mergeAll(Env.Live, ServicesLayer, FileSystemLayer, Git.GitLive, spawnerLayer, npmLayer),
)(
  Effect.gen(function* () {
    const input = yield* args.fromFile
      ? loadForecastInputFromFile(args.fromFile)
      : buildForecastInput()

    const rendered =
      args.format === 'table'
        ? Api.Renderer.renderTable(input.forecast)
        : args.format === 'tree'
          ? Api.Renderer.renderTree(input.forecast)
          : Api.Forecaster.encodeForecastEnvelope({
              forecast: input.forecast,
              publishState: input.publishState,
              publishHistory: input.publishHistory,
            })

    yield* Console.log(rendered)
  }),
)

interface ForecastInput {
  readonly forecast: Api.Forecaster.Forecast
  readonly publishState: Api.Commentator.PublishState
  readonly publishHistory: readonly Api.Commentator.PublishRecord[]
  readonly interactiveChecklist: boolean
}

const buildForecastInput = () =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const workspace = yield* loadCommandWorkspace()
    if (!isReadyCommandWorkspace(workspace)) {
      yield* Console.log(noPackagesFoundMessage)
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

    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({ packages, tags })
    const recon = yield* Api.Explorer.explore()
    const forecast = Api.Forecaster.forecast(analysis, recon)

    return {
      forecast,
      publishState: 'idle' as const,
      publishHistory: [],
      interactiveChecklist: (config.publishing.ephemeral ?? { mode: 'manual' }).mode !== 'manual',
    }
  })

const loadForecastInputFromFile = (filePath: string) =>
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
      }
    }

    return {
      forecast: yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Api.Forecaster.Forecast))(
        jsonText,
      ),
      publishState: 'idle' as const,
      publishHistory: [],
      interactiveChecklist: false,
    }
  })
