import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Str } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { EffectSchema, Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'

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
  .use(EffectSchema)
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
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer, Git.GitLive))(
  Effect.gen(function*() {
    const git = yield* Git.Git

    // Load config and scan packages
    const _config = yield* Api.Config.load()
    const packages = yield* Api.Analyzer.Workspace.scan

    if (packages.length === 0) {
      yield* Console.log('No packages found.')
      return
    }

    // Build release options
    const options = {
      ...(args.pkg && { packages: args.pkg }),
      ...(args.exclude && { exclude: args.exclude }),
    }

    // Generate plan based on type
    const header = Str.Builder()
    header`Generating ${args.type} release plan...`
    header``
    yield* Console.log(header.render())

    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({
      packages,
      tags,
      filter: args.pkg ? [...args.pkg] : undefined,
      exclude: args.exclude ? [...args.exclude] : undefined,
    })
    const ctx = { packages }

    const plan = yield* (
      args.type === 'stable'
        ? Api.Planner.official(analysis, ctx, options)
        : args.type === 'preview'
        ? Api.Planner.candidate(analysis, ctx, options)
        : Api.Planner.ephemeral(analysis, ctx, options)
    )

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
