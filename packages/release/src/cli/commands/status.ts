/**
 * @module cli/commands/status
 *
 * Show unreleased changes across workspace packages.
 *
 * Analyzes commits since the last release tag for each package and
 * displays projected version bumps. When specific packages are provided,
 * also performs cascade analysis to show transitive dependent releases.
 */
import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'

/**
 * release status [pkg...]
 *
 * Show unreleased changes. If packages specified, also shows cascade analysis.
 */
const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Show unreleased changes and cascade analysis')
  .parameter(
    'packages',
    Schema.UndefinedOr(Schema.Array(Schema.String)).pipe(
      Schema.annotations({ description: 'Specific packages to analyze cascades for' }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer, Git.GitLive))(
  Effect.gen(function* () {
    const git = yield* Git.Git

    // Load config and scan packages
    const _config = yield* Api.Config.load()
    const packages = yield* Api.Analyzer.Workspace.scan

    if (packages.length === 0) {
      yield* Console.log(
        'No packages found. Check release.config.ts `packages` field ' +
          'or ensure pnpm-workspace.yaml defines workspace packages.',
      )
      return
    }

    // Analyze then plan what would be released
    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({ packages, tags })
    const plan = yield* Api.Planner.official(analysis, { packages })

    if (plan.releases.length === 0) {
      yield* Console.log('No unreleased changes.')
      return
    }

    // Display all pending releases
    yield* Console.log(Api.Renderer.renderStatus(plan.releases))

    // If specific packages requested, show cascade analysis
    if (args.packages && args.packages.length > 0) {
      const cascadeAnalysis = yield* Api.Planner.Cascade.analyzeRequested(
        packages,
        plan.releases,
        args.packages,
        tags,
      )
      yield* Console.log(Api.Renderer.renderCascadeAnalysis(cascadeAnalysis))
    }
  }),
)
