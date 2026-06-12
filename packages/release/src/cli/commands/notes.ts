/**
 * @module cli/commands/notes
 *
 * Generate and display release notes from unreleased commits.
 *
 * Fetches commits since the last release tag, extracts conventional
 * commit impacts, and formats them as markdown or JSON. Optionally
 * filters to a specific package.
 */
import { Git } from '@kitz/git'
import { Console, Effect, Layer, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import * as Notes from '../../api/notes/__.js'
import { CommandBaseLayer, failWith, withReadyWorkspace } from './_shared.js'

export const notes = Command.make(
  'notes',
  {
    pkg: Argument.string('pkg').pipe(
      Argument.withDescription('Filter to specific package (default: all packages)'),
      Argument.optional,
    ),
    format: Flag.choice('format', ['md', 'json']).pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Output format'),
      Flag.withDefault('md'),
    ),
    since: Flag.string('since').pipe(
      Flag.withAlias('s'),
      Flag.withDescription('Show changes since this tag (default: last release tag)'),
      Flag.optional,
    ),
    until: Flag.string('until').pipe(
      Flag.withAlias('u'),
      Flag.withDescription('Stop at this tag or SHA instead of HEAD'),
      Flag.optional,
    ),
  },
  ({ pkg, format, since, until }) =>
    withReadyWorkspace((workspace) =>
      Effect.gen(function* () {
        const git = yield* Git.Git
        const { packages } = workspace

        // #216: validate an explicitly-requested package against the workspace, so a
        // typo'd name reports "not found" with the available identifiers rather than
        // masquerading as "No unreleased release notes found."
        if (Option.isSome(pkg)) {
          const requested = pkg.value
          const known = packages.some((p) => p.scope === requested || p.name.moniker === requested)
          if (!known) {
            return yield* failWith(
              `Package "${requested}" was not found in the workspace.`,
              'Available package identifiers:',
              ...packages.map((p) => `  ${p.scope}`),
            )
          }
        }

        const tags = yield* git.getTags()
        const result = yield* Notes.generate({
          packages,
          tags,
          since: Option.getOrUndefined(since),
          until: Option.getOrUndefined(until),
          filter: Option.isSome(pkg) ? [pkg.value] : undefined,
          resolvedConventionalCommitTypes: workspace.config.resolvedConventionalCommitTypes,
          commitOverrides: workspace.config.commitOverrides,
        })

        if (result.notes.length === 0) {
          yield* Console.log('No unreleased release notes found.')
          return
        }

        if (format === 'json') {
          yield* Console.log(JSON.stringify(Notes.toJsonNotes(result.notes), null, 2))
          return
        }

        yield* Console.log(Notes.renderMarkdownNotes(result.notes))
      }),
    ),
).pipe(
  Command.withDescription('Show unreleased release notes since the last release'),
  Command.provide(Layer.mergeAll(CommandBaseLayer, Git.GitLive)),
)
