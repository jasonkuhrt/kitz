/**
 * @module cli/commands/plan
 *
 * Generate a release plan based on conventional commits since the last release.
 *
 * Supports three release types:
 * - `stable` — Standard semver release (official lifecycle)
 * - `preview` — Pre-release to the `@next` dist-tag (candidate lifecycle)
 * - `pr` — PR preview release for integration testing (ephemeral lifecycle)
 *
 * The plan is written to `.release/plan.json` and can be executed with `release apply`.
 */
import { FileSystem } from '@effect/platform'
import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Str } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Option, Schema } from 'effect'
import * as Api from '../../api/__.js'

const PublishStateSchema = Schema.Literal('idle', 'publishing', 'published', 'failed')
const PublishRecordSchema = Schema.Struct({
  package: Schema.String,
  version: Schema.String,
  iteration: Schema.Number,
  sha: Schema.String,
  timestamp: Schema.String,
  runId: Schema.String,
})
const PublishHistoryEnvelopeSchema = Schema.Struct({
  publishes: Schema.Array(PublishRecordSchema),
})
const PublishHistoryJsonSchema = Schema.parseJson(PublishHistoryEnvelopeSchema)
const decodePublishHistory = Schema.decodeUnknownOption(PublishHistoryJsonSchema)

const ForecastEnvelopeSchema = Schema.Struct({
  forecast: Api.Forecaster.Forecast,
  publishState: PublishStateSchema,
  publishHistory: Schema.Array(PublishRecordSchema),
})
const ForecastEnvelopeJsonSchema = Schema.parseJson(ForecastEnvelopeSchema)
const encodeForecastEnvelope = Schema.encodeSync(ForecastEnvelopeJsonSchema)

const readPublishHistory = (
  filePath: string | undefined,
): Effect.Effect<readonly Api.Commentator.PublishRecord[], never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    if (!filePath) return []

    const fs = yield* FileSystem.FileSystem
    const parsed = yield* fs
      .readFileString(filePath)
      .pipe(Effect.option, Effect.map(Option.flatMap(decodePublishHistory)))

    return parsed.pipe(
      Option.map((value) => value.publishes),
      Option.getOrElse((): readonly Api.Commentator.PublishRecord[] => []),
    )
  })

/**
 * release plan <type>
 *
 * Generate a release plan. Writes to .release/plan.json.
 *
 * Types:
 * - stable  - Standard semver release
 * - preview - Pre-release to @next tag
 * - pr      - PR preview release
 */
const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Generate a release plan')
  .parameter(
    'type',
    Schema.Literal('stable', 'preview', 'pr').pipe(
      Schema.annotations({ description: 'Release type: stable, preview, or pr' }),
    ),
  )
  .parameter(
    'pkg p',
    Schema.UndefinedOr(Schema.Array(Schema.String)).pipe(
      Schema.annotations({ description: 'Only include specific package(s)' }),
    ),
  )
  .parameter(
    'exclude x',
    Schema.UndefinedOr(Schema.Array(Schema.String)).pipe(
      Schema.annotations({ description: 'Exclude package(s)' }),
    ),
  )
  .parameter(
    'json',
    Schema.transform(Schema.UndefinedOr(Schema.Boolean), Schema.Boolean, {
      strict: true,
      decode: (v) => v ?? false,
      encode: (v) => v,
    }).pipe(
      Schema.annotations({
        description: 'Output forecast JSON for render/comment workflows',
        default: false,
      }),
    ),
  )
  .parameter(
    'publish-history',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({ description: 'Path to JSON file containing prior publish history' }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer, Git.GitLive))(
  Effect.gen(function* () {
    const git = yield* Git.Git

    // Load config and scan packages
    const config = yield* Api.Config.load()
    const packages = yield* Api.Analyzer.Workspace.resolvePackages(config.packages)

    if (packages.length === 0) {
      yield* Console.log(
        'No packages found. Check release.config.ts `packages` field ' +
          'or ensure pnpm-workspace.yaml defines workspace packages.',
      )
      return
    }

    // Build release options
    const options = {
      ...(args.pkg && { packages: args.pkg }),
      ...(args.exclude && { exclude: args.exclude }),
    }

    // Generate plan based on type
    if (!args.json) {
      const header = Str.Builder()
      header`Generating ${args.type} release plan...`
      header``
      yield* Console.log(header.render())
    }

    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({
      packages,
      tags,
      filter: args.pkg ? [...args.pkg] : undefined,
      exclude: args.exclude ? [...args.exclude] : undefined,
    })
    const ctx = { packages }

    const plan = yield* args.type === 'stable'
      ? Api.Planner.official(analysis, ctx, options)
      : args.type === 'preview'
        ? Api.Planner.candidate(analysis, ctx, options)
        : Api.Planner.ephemeral(analysis, ctx, options)

    if (args.json) {
      const recon = yield* Api.Explorer.explore()
      const publishHistory = yield* readPublishHistory(args.publishHistory)
      const forecast = Api.Forecaster.forecast(analysis, recon)

      yield* Console.log(
        encodeForecastEnvelope({
          forecast,
          publishState: 'idle',
          publishHistory,
        }),
      )
      return
    }

    if (plan.releases.length === 0) {
      yield* Console.log('No releases planned - no unreleased changes found.')
      return
    }

    // Display plan
    yield* Console.log(Api.Renderer.renderPlan(plan))

    // Write plan file using resource
    const env = yield* Env.Env
    const planDir = Fs.Path.join(env.cwd, Api.Planner.PLAN_DIR)

    // Ensure directory exists
    yield* Fs.write(planDir, { recursive: true })

    // Write plan using schema-validated resource
    yield* Api.Planner.resource.write(plan, planDir)

    const done = Str.Builder()
    done`Plan written to ${Fs.Path.toString(Api.Planner.PLAN_FILE)}`
    done`Run 'release apply' to execute.`
    yield* Console.log(done.render())
  }),
)
