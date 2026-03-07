/**
 * @module cli/commands/plan
 *
 * Generate a release plan based on conventional commits since the last release.
 *
 * Supports three release lifecycles:
 * - `official` — Standard semver release
 * - `candidate` — Pre-release to the `next` dist-tag
 * - `ephemeral` — Per-PR integration release
 *
 * The plan is written to `.release/plan.json` and can be executed with `release apply`.
 */
import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Str } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'

/**
 * release plan --lifecycle <official|candidate|ephemeral>
 *
 * Generate a release plan. Writes to .release/plan.json.
 */
const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Generate a release plan')
  .parameter(
    'lifecycle l',
    Schema.Literal('official', 'candidate', 'ephemeral').pipe(
      Schema.annotations({
        description: 'Release lifecycle: official, candidate, or ephemeral',
      }),
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
  Effect.gen(function* () {
    const git = yield* Git.Git

    // Load config and scan packages
    const config = yield* Api.Config.load()
    const packages = yield* Api.Analyzer.Workspace.resolvePackages(config.packages)

    if (packages.length === 0) {
      yield* Console.log(
        'No packages found. Check release.config.ts `packages` field ' +
          'or ensure the root package.json defines workspace packages.',
      )
      return
    }

    // Build release options
    const options = {
      ...(args.pkg && { packages: args.pkg }),
      ...(args.exclude && { exclude: args.exclude }),
    }

    // Generate plan based on type
    const header = Str.Builder()
    header`Generating ${args.lifecycle} release plan...`
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

    const plan = yield* args.lifecycle === 'official'
      ? Api.Planner.official(analysis, ctx, options)
      : args.lifecycle === 'candidate'
        ? Api.Planner.candidate(analysis, ctx, options)
        : Api.Planner.ephemeral(analysis, ctx, options)

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
