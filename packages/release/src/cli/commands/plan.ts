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
 * The plan is written to `.release/plan.json` by default and can be executed with `release apply`.
 */
import { Cli } from '@kitz/cli'
import { Str } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'

/**
 * release plan --lifecycle <official|candidate|ephemeral>
 *
 * Generate a release plan. Writes to .release/plan.json by default.
 */
const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Generate a release plan')
  .parameter(
    'lifecycle l',
    Schema.Literals(['official', 'candidate', 'ephemeral']).pipe(
      Schema.annotate({
        description: 'Release lifecycle: official, candidate, or ephemeral',
      }),
    ),
  )
  .parameter(
    'pkg p',
    Schema.UndefinedOr(Schema.Array(Schema.String)).pipe(
      Schema.annotate({ description: 'Only include specific package(s)' }),
    ),
  )
  .parameter(
    'exclude x',
    Schema.UndefinedOr(Schema.Array(Schema.String)).pipe(
      Schema.annotate({ description: 'Exclude package(s)' }),
    ),
  )
  .parameter(
    'out o',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'Write the generated plan to a specific file path' }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer, Git.GitLive))(
  Effect.gen(function* () {
    const git = yield* Git.Git

    const workspace = yield* loadCommandWorkspace()
    if (!isReadyCommandWorkspace(workspace)) {
      yield* Console.log(noPackagesFoundMessage)
      return
    }
    const { packages } = workspace

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

    const planPath = args.out !== undefined ? Fs.Path.fromString(args.out) : undefined
    const planLocation = yield* Api.Planner.Store.resolvePlanLocation(planPath)

    yield* Api.Planner.Store.write(plan, planPath)

    const done = Str.Builder()
    done`Plan written to ${Fs.Path.toString(planLocation.file)}`
    done`Run 'release apply${args.out ? ` --from ${args.out}` : ''}' to execute.`
    yield* Console.log(done.render())
  }),
)
