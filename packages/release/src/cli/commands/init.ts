/**
 * @module cli/commands/init
 *
 * Initialize release configuration in a project.
 *
 * Creates a `release.config.ts` file with sensible defaults, scans
 * the workspace for packages, and adds `.release/` to `.gitignore`.
 * Safe to run multiple times (idempotent).
 */
import { Str } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Console, Effect, Layer, Match } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Analyzer from '../../api/analyzer/__.js'
import * as Config from '../../api/config.js'
import { FileSystemLayer } from '../../platform.js'

const RELEASE_DIR_PATTERN = '.release/'

/**
 * release init
 *
 * Initialize release in a project.
 */
export const init = Command.make(
  'init',
  {
    force: Flag.boolean('force').pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Overwrite existing config'),
      Flag.withDefault(false),
    ),
  },
  ({ force }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env

      const header = Str.Builder()
      header`Initializing release...`
      header``
      yield* Console.log(header.render())

      // Initialize config file
      const configResult = yield* Config.init({ force })
      yield* Match.value(configResult).pipe(
        Match.tagsExhaustive({
          Created: (r) => Console.log(`✓ Created ${r.path.name}`),
          AlreadyExists: () => Console.log(`✓ Config already exists`),
        }),
      )

      // Scan packages
      const packages = yield* Analyzer.Workspace.scan
      yield* Console.log(`✓ Detected ${packages.length} package${packages.length === 1 ? '' : 's'}`)

      // Add .release/ to .gitignore
      const gitignorePath = Fs.Path.join(env.cwd, Git.Paths.GITIGNORE)
      const existingContent = yield* Fs.readString(gitignorePath).pipe(
        Effect.catchTag('PlatformError', () => Effect.succeed('')),
      )

      const gitignore =
        existingContent === '' ? Git.Gitignore.empty : Git.Gitignore.fromString(existingContent)

      if (gitignore.hasPattern(RELEASE_DIR_PATTERN)) {
        yield* Console.log(`✓ ${RELEASE_DIR_PATTERN} already in .gitignore`)
      } else {
        const updated = gitignore.addPattern(RELEASE_DIR_PATTERN)
        yield* Fs.write(gitignorePath, Git.Gitignore.toString(updated))

        const action = existingContent === '' ? 'Created .gitignore with' : 'Added'
        yield* Console.log(`✓ ${action} ${RELEASE_DIR_PATTERN} to .gitignore`)
      }

      yield* Console.log(Str.Tpl.dedent`

        Done! Release scaffolding is ready.

        Next steps:
          1. Review release.config.ts and decide how each lifecycle should publish
          2. Run \`release forecast\` to inspect what would release right now
          3. Run \`release doctor --all\` to audit auth, tags, metadata, and workflow wiring
          4. Run \`release plan --lifecycle official\` to generate the exact publish plan
      `)
    }),
).pipe(
  Command.withDescription('Initialize release configuration'),
  Command.provide(Layer.mergeAll(Env.Live, FileSystemLayer)),
)
