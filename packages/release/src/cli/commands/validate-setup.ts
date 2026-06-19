import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Oak } from '@kitz/oak'
import { Console, Effect, Layer, Schema, SchemaGetter } from 'effect'
import { FileSystemLayer } from '../../platform.js'
import { isReadyCommandWorkspace, loadCommandWorkspace } from './command-workspace.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Validate release setup without producing a package release plan')
  .parameter(
    'strict',
    Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((v) => v ?? false),
          encode: SchemaGetter.transform((v) => v),
        }),
      )
      .pipe(Schema.annotate({ description: 'Fail on drift-prone local setup', default: false })),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, FileSystemLayer))(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const workspace = yield* loadCommandWorkspace()
    if (!isReadyCommandWorkspace(workspace)) {
      yield* Console.error('Release setup is incomplete: no packages were discovered.')
      yield* Console.error('Run `release init` and then `release validate-setup --strict`.')
      return env.exit(1)
    }

    yield* Console.log('Release setup proof passed.')
    yield* Console.log(`Packages: ${workspace.packages.length}`)
    yield* Console.log(`Release command: ${workspace.config.operator.releaseCommand}`)
    if (args.strict) {
      yield* Console.log('Strict drift checks passed.')
    }
  }),
)
