/**
 * @module cli/commands/conformance
 *
 * Run provider conformance checks (`release conformance run`) against a publish
 * provider and report supported/unsupported capabilities.
 */
import { Str } from '@kitz/core'
import { Console, Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Publisher from '../../api/publishing/__.js'
import { CommandBaseLayer, failWith } from './_shared.js'

const providers = {
  npm: Publisher.Providers.Npm,
  pnpm: Publisher.Providers.Pnpm,
  bun: Publisher.Providers.Bun,
} as const

const conformanceRun = Command.make(
  'run',
  {
    provider: Flag.choice('provider', ['npm', 'pnpm', 'bun']).pipe(
      Flag.withDescription('Provider to check'),
      Flag.withDefault('npm'),
    ),
    format: Flag.choice('format', ['text', 'json']).pipe(
      Flag.withDescription('Output format'),
      Flag.withDefault('text'),
    ),
  },
  ({ provider: providerId, format }) =>
    Effect.gen(function* () {
      const provider = providers[providerId]

      const report = Publisher.Conformance.run(provider)
      const invalid = report.results.filter((result) =>
        result.errorCode?.includes('invalid-capability-result'),
      )
      if (format === 'json') {
        yield* Console.log(JSON.stringify(report, null, 2))
        return
      }

      if (invalid.length > 0) {
        const b = Str.Builder()
        b`Conformance failed for provider ${providerId}.`
        for (const result of invalid) {
          b`invalid result: ${result.capability}`
        }
        yield* failWith(b.render())
        return
      }

      const unsupported = report.results.filter((result) => result.result === 'unsupported')
      const b = Str.Builder()
      b`Conformance passed for provider ${providerId}.`
      b`Capabilities: ${String(report.results.length - unsupported.length)} supported, ${String(unsupported.length)} unsupported.`
      yield* Console.log(b.render())
    }),
).pipe(Command.withDescription('Run provider conformance checks'))

export const conformance = Command.make('conformance').pipe(
  Command.withDescription('Run provider conformance checks'),
  Command.withSubcommands([conformanceRun]),
  Command.provide(CommandBaseLayer),
)
