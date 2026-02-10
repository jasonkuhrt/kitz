import { NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Str } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { EffectSchema, Oak } from '@kitz/oak'
import { Console, Effect, Layer, Match, Schema as S } from 'effect'
import * as Api from '../../api/__.js'

const RELEASE_DIR_PATTERN = '.release/'

/**
 * release init
 *
 * Initialize release in a project.
 */
Oak.Command.create()
  .use(EffectSchema)
  .description('Initialize release configuration')
  .parameter(
    'force f',
    S.transform(
      S.UndefinedOr(S.Boolean),
      S.Boolean,
      {
        strict: true,
        decode: (v) => v ?? false,
        encode: (v) => v,
      },
    ).pipe(
      S.annotations({ description: 'Overwrite existing config', default: false }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeFileSystem.layer))(
  Effect.gen(function*() {
    const env = yield* Env.Env

    const header = Str.Builder()
    header`Initializing release...`
    header``
    yield* Console.log(header.render())

    // Initialize config file
    const configResult = yield* Api.Config.init()
    yield* Match.value(configResult).pipe(
      Match.tagsExhaustive({
        Created: (r) => Console.log(`✓ Created ${r.path.name}`),
        AlreadyExists: () => Console.log(`✓ Config already exists`),
      }),
    )

    // Scan packages
    const packages = yield* Api.Workspace.scan
    yield* Console.log(`✓ Detected ${packages.length} package${packages.length === 1 ? '' : 's'}`)

    // Add .release/ to .gitignore
    const gitignorePath = Fs.Path.join(env.cwd, Git.Paths.GITIGNORE)
    const existingContent = yield* Fs.readString(gitignorePath).pipe(
      Effect.catchTag('SystemError', () => Effect.succeed('')),
    )

    const gitignore = existingContent === ''
      ? Git.Gitignore.empty
      : Git.Gitignore.fromString(existingContent)

    if (gitignore.hasPattern(RELEASE_DIR_PATTERN)) {
      yield* Console.log(`✓ ${RELEASE_DIR_PATTERN} already in .gitignore`)
    } else {
      const updated = gitignore.addPattern(RELEASE_DIR_PATTERN)
      yield* Fs.write(gitignorePath, Git.Gitignore.toString(updated))

      const action = existingContent === '' ? 'Created .gitignore with' : 'Added'
      yield* Console.log(`✓ ${action} ${RELEASE_DIR_PATTERN} to .gitignore`)
    }

    yield* Console.log(Str.Tpl.dedent`

      Done! Release is ready.

      Next steps:
        1. Review release.config.ts
        2. Run \`release status\` to see pending changes
        3. Run \`release plan stable\` to generate a release plan
    `)
  }),
)
