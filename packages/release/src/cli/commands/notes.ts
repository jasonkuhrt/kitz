/**
 * @module cli/commands/notes
 *
 * Generate and display release notes from unreleased commits.
 *
 * Fetches commits since the last release tag, extracts conventional
 * commit impacts, and formats them as markdown or JSON. Optionally
 * filters to a specific package.
 */
import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'

/**
 * release notes [pkg]
 *
 * Show unreleased release notes since the last release.
 */
const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Show unreleased release notes since the last release')
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
    ).pipe(Schema.annotations({ description: 'Output format', default: 'md' })),
  )
  .parameter(
    'since s',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({
        description: 'Show changes since this tag (default: last release tag)',
      }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer, Git.GitLive))(
  Effect.gen(function* () {
    const git = yield* Git.Git

    const _config = yield* Api.Config.load()
    const packages = yield* Api.Analyzer.Workspace.scan

    if (packages.length === 0) {
      yield* Console.log(
        'No packages found. Check release.config.ts `packages` field ' +
          'or ensure the root package.json defines workspace packages.',
      )
      return
    }

    const tags = yield* git.getTags()
    const result = yield* Api.Notes.generate({
      packages,
      tags,
      since: args.since,
      filter: args.pkg ? [args.pkg] : undefined,
    })

    if (result.notes.length === 0) {
      yield* Console.log('No unreleased release notes found.')
      return
    }

    if (args.format === 'json') {
      yield* Console.log(JSON.stringify(Api.Notes.toJsonNotes(result.notes), null, 2))
      return
    }

    yield* Console.log(Api.Notes.renderMarkdownNotes(result.notes))
  }),
)
