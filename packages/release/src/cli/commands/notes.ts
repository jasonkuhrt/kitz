/**
 * @module cli/commands/notes
 *
 * Generate and display release notes from unreleased commits.
 *
 * Fetches commits since the last release tag, extracts conventional
 * commit impacts, and formats them as markdown or JSON. Optionally
 * filters to a specific package.
 */
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { FileSystemLayer } from '../../platform.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'

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
      Schema.annotate({ description: 'Filter to specific package (default: all packages)' }),
    ),
  )
  .parameter(
    'format f',
    Schema.UndefinedOr(Schema.Literals(['md', 'json']))
      .pipe(
        Schema.decodeTo(Schema.Literals(['md', 'json']), {
          decode: SchemaGetter.transform((v) => v ?? 'md'),
          encode: SchemaGetter.transform((v) => v),
        }),
      )
      .pipe(Schema.annotate({ description: 'Output format', default: 'md' })),
  )
  .parameter(
    'since s',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({
        description: 'Show changes since this tag (default: last release tag)',
      }),
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
