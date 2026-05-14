import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Console, Effect, Schema } from 'effect'
import * as Api from '../../api/__.js'

const flagValue = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

const providerFor = (provider: string) => {
  switch (provider) {
    case 'npm':
      return Api.Publisher.Providers.Npm
    case 'pnpm':
      return Api.Publisher.Providers.Pnpm
    case 'bun':
      return Api.Publisher.Providers.Bun
    default:
      return undefined
  }
}

Cli.run(Env.Live)(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const argv = yield* Cli.parseArgv(env.argv)
    const args = argv.args.slice(1)
    const action = args[0] ?? 'run'
    if (action !== 'run') {
      yield* Console.error('Usage: release conformance run --provider <provider-id>')
      return env.exit(1)
    }

    const providerId = flagValue(args, '--provider') ?? 'npm'
    const provider = providerFor(providerId)
    if (provider === undefined) {
      yield* Console.error(`Unknown provider: ${providerId}`)
      yield* Console.error('Supported providers: npm, pnpm, bun')
      return env.exit(1)
    }

    const invalid = Api.Publisher.Models.publishCapabilityValues.filter(
      (capability) =>
        !Schema.is(Api.Publisher.Models.CapabilityResult)(provider.capabilityResult(capability)),
    )
    if (invalid.length > 0) {
      yield* Console.error(`Conformance failed for provider ${providerId}.`)
      for (const capability of invalid) yield* Console.error(`invalid result: ${capability}`)
      return env.exit(1)
    }

    const unsupported = Api.Publisher.Models.publishCapabilityValues.filter(
      (capability) => provider.capabilityResult(capability)._tag === 'Unsupported',
    )
    yield* Console.log(`Conformance passed for provider ${providerId}.`)
    yield* Console.log(
      `Capabilities: ${String(Api.Publisher.Models.publishCapabilityValues.length - unsupported.length)} supported, ${String(unsupported.length)} unsupported.`,
    )
  }),
)
