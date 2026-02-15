import { FileSystem } from '@effect/platform'
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
  .parameter(
    'tag t',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({ description: 'Dist-tag for preview (default: next)' }),
    ),
  )
  .parameter(
    'comment',
    Schema.UndefinedOr(Schema.Literal(true)).pipe(
      Schema.annotations({ description: 'Output PR comment markdown to stdout' }),
    ),
  )
  .parameter(
    'viz',
    Schema.UndefinedOr(Schema.Literal('tree')).pipe(
      Schema.annotations({ description: 'Output tree visualization to stdout' }),
    ),
  )
  .parameter(
    'publish-history',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({ description: 'Path to JSON file with publish history (from existing PR comment)' }),
    ),
  )
  .parameter(
    'json j',
    Schema.UndefinedOr(Schema.Literal(true)).pipe(
      Schema.annotations({ description: 'Output enriched plan as JSON to stdout' }),
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

    // Only show human-readable header when not in machine output mode
    const machineOutput = args.comment || args.viz || args.json
    if (!machineOutput) {
      yield* Console.log(header.render())
    }

    // Analyze first — the expensive analytical core
    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({
      packages,
      tags,
      filter: args.pkg ? [...args.pkg] : undefined,
      exclude: args.exclude ? [...args.exclude] : undefined,
    })

    // Plan — lightweight version projection
    const ctx = { packages }
    const plan = yield* (
      args.type === 'stable'
        ? Api.Planner.stable(analysis, ctx, options)
        : args.type === 'preview'
        ? Api.Planner.preview(analysis, ctx, options)
        : Api.Planner.pr(analysis, ctx, options)
    )

    if (plan.releases.length === 0) {
      yield* Console.log('No releases planned - no unreleased changes found.')
      return
    }

    // Write plan file using resource
    const env = yield* Env.Env
    const planDir = Fs.Path.join(env.cwd, Api.Planner.PLAN_DIR)

    // Ensure directory exists
    yield* Fs.write(planDir, { recursive: true })

    // Write plan using schema-validated resource
    yield* Api.Planner.resource.write(plan, planDir)

    // Machine output modes: --comment or --viz
    if (machineOutput) {
      const prNumber = Api.Planner.detectPrNumber(env.vars) ?? 0
      const github = yield* Api.Planner.resolveGitHubContext(prNumber)

      // Read publish history from file if provided
      let publishHistory: Api.Planner.PublishRecord[] = []
      if (args.publishHistory) {
        const fs = yield* FileSystem.FileSystem
        const content = yield* fs.readFileString(args.publishHistory)
        try {
          const parsed = JSON.parse(content)
          if (parsed?.publishes && Array.isArray(parsed.publishes)) {
            publishHistory = parsed.publishes
          }
        } catch {
          // Malformed JSON — proceed with empty history
        }
      }

      const commentData = Api.Planner.enrichPlan(plan, { github, publishHistory })

      if (args.json) {
        const serialized = Api.Planner.serializeCommentData(commentData)
        yield* Console.log(JSON.stringify(serialized, null, 2))
      }
      if (args.comment) {
        yield* Console.log(Api.Planner.renderComment(commentData))
      }
      if (args.viz === 'tree') {
        yield* Console.log(Api.Planner.renderTree(commentData))
      }
    } else {
      // Human-readable output
      yield* Console.log(Api.Planner.renderPlan(plan))

      const done = Str.Builder()
      done`Plan written to ${Fs.Path.toString(Api.Planner.PLAN_FILE)}`
      done`Run 'release apply' to execute.`
      yield* Console.log(done.render())
    }
  }),
)
