/**
 * @module cli/commands/conformance
 *
 * Run provider conformance checks (`release conformance run`) against a publish
 * provider and report supported/unsupported capabilities.
 */
import { Env } from '@kitz/env'
import { Console, Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Publisher from '../../api/publishing/__.js'

const providerFor = (provider: string) => {
  switch (provider) {
    case 'npm':
      return Publisher.Providers.Npm
    case 'pnpm':
      return Publisher.Providers.Pnpm
    case 'bun':
      return Publisher.Providers.Bun
    default:
      return undefined
  }
}

const conformanceRun = Command.make(
  'run',
  {
    provider: Flag.string('provider').pipe(
      Flag.withDescription('Provider to check (npm, pnpm, bun)'),
      Flag.withDefault('npm'),
    ),
    format: Flag.string('format').pipe(
      Flag.withDescription('Output format (text, json)'),
      Flag.withDefault('text'),
    ),
  },
  ({ provider: providerId, format }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env

      const provider = providerFor(providerId)
      if (provider === undefined) {
        yield* Console.error(`Unknown provider: ${providerId}`)
        yield* Console.error('Supported providers: npm, pnpm, bun')
        return env.exit(1)
      }

      const report = Publisher.Conformance.run(provider)
      const invalid = report.results.filter((result) =>
        result.errorCode?.includes('invalid-capability-result'),
      )
      if (format === 'json') {
        yield* Console.log(JSON.stringify(report, null, 2))
        return
      }

      if (invalid.length > 0) {
        yield* Console.error(`Conformance failed for provider ${providerId}.`)
        for (const result of invalid) yield* Console.error(`invalid result: ${result.capability}`)
        return env.exit(1)
      }

      const unsupported = report.results.filter((result) => result.result === 'unsupported')
      yield* Console.log(`Conformance passed for provider ${providerId}.`)
      yield* Console.log(
        `Capabilities: ${String(report.results.length - unsupported.length)} supported, ${String(unsupported.length)} unsupported.`,
      )
    }),
).pipe(Command.withDescription('Run provider conformance checks'))

export const conformance = Command.make('conformance').pipe(
  Command.withDescription('Run provider conformance checks'),
  Command.withSubcommands([conformanceRun]),
  Command.provide(Env.Live),
)
