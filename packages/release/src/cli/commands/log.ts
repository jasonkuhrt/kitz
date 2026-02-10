import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { EffectSchema, Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'

/**
 * release log [pkg]
 *
 * Show unreleased changes since last release.
 */
const args = Oak.Command.create()
  .use(EffectSchema)
  .description('Show unreleased changes since last release')
  .parameter(
    'pkg p',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({ description: 'Filter to specific package (default: all packages)' }),
    ),
  )
  .parameter(
    'format f',
    Schema.transform(
      Schema.UndefinedOr(Schema.Literal('md', 'json')),
      Schema.Literal('md', 'json'),
      {
        strict: true,
        decode: (v) => v ?? 'md',
        encode: (v) => v,
      },
    ).pipe(
      Schema.annotations({ description: 'Output format', default: 'md' }),
    ),
  )
  .parameter(
    'since s',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({ description: 'Show changes since this tag (default: last release tag)' }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer, Git.GitLive))(
  Effect.gen(function*() {
    const git = yield* Git.Git

    // Load config and scan packages
    const _config = yield* Api.Config.load()
    const packages = yield* Api.Workspace.scan

    if (packages.length === 0) {
      yield* Console.log('No packages found.')
      return
    }

    // Get all tags
    const tags = yield* git.getTags()

    // Generate logs using the Log API
    const result = yield* Api.Log.generate({
      packages,
      tags,
      since: args.since,
      filter: args.pkg ? [args.pkg] : undefined,
    })

    if (result.logs.length === 0) {
      yield* Console.log('No unreleased changes found.')
      return
    }

    // Output based on format
    if (args.format === 'json') {
      const jsonOutput = Api.Log.toJsonLogs(result.logs)
      yield* Console.log(JSON.stringify(jsonOutput, null, 2))
    } else {
      yield* Console.log(Api.Log.renderMarkdownLogs(result.logs))
    }
  }),
)
