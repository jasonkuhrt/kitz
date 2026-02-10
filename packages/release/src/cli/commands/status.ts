import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { EffectSchema, Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'

/**
 * release status [pkg...]
 *
 * Show unreleased changes. If packages specified, also shows cascade analysis.
 */
const args = Oak.Command.create()
  .use(EffectSchema)
  .description('Show unreleased changes and cascade analysis')
  .parameter(
    'packages',
    Schema.UndefinedOr(Schema.Array(Schema.String)).pipe(
      Schema.annotations({ description: 'Specific packages to analyze cascades for' }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer, Git.GitLive))(
  Effect.gen(function*() {
    // Load config and scan packages
    const _config = yield* Api.Config.load()
    const packages = yield* Api.Workspace.scan

    if (packages.length === 0) {
      yield* Console.log('No packages found.')
      return
    }

    // Plan what would be released
    const plan = yield* Api.Plan.stable({ packages })

    if (plan.releases.length === 0) {
      yield* Console.log('No unreleased changes.')
      return
    }

    // Display all pending releases
    yield* Console.log(Api.Plan.renderStatus(plan.releases))

    // If specific packages requested, show cascade analysis
    if (args.packages && args.packages.length > 0) {
      const tags = yield* Git.Git.pipe(Effect.flatMap((git) => git.getTags()))
      const cascadeAnalysis = yield* Api.Cascade.analyzeRequested(packages, plan.releases, args.packages, tags)
      yield* Console.log(Api.Plan.renderCascadeAnalysis(cascadeAnalysis))
    }
  }),
)
