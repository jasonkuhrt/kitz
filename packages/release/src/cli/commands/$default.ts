import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Console, Effect } from 'effect'
import { formatRootHelp, isRootHelpRequest } from '../help.js'

Cli.run(Env.Live)(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const argv = yield* Cli.parseArgv(env.argv)

    if (isRootHelpRequest(argv.args)) {
      yield* Console.log(formatRootHelp())
      return
    }

    yield* Console.error(`Error: Unknown option "${argv.args[0]}".`)
    yield* Console.error('')
    yield* Console.error(formatRootHelp())
    return env.exit(1)
  }),
)
