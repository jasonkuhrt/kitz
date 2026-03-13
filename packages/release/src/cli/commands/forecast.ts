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
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Option, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, ServicesLayer, FileSystemLayer } from '../../platform.js'

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

Cli.run(Layer.mergeAll(Env.Live, ServicesLayer, FileSystemLayer, Git.GitLive, spawnerLayer))(
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
    const config = yield* Api.Config.load()
    const packages = yield* Api.Analyzer.Workspace.resolvePackages(config.packages)

    if (packages.length === 0) {
      yield* Console.log(
        'No packages found. Check release.config.ts `packages` field ' +
          'or ensure the root package.json defines workspace packages.',
      )
      return {
        forecast: new Api.Forecaster.Forecast({
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
