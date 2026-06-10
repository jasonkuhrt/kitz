/**
 * @module cli/commands/matrix
 *
 * Verify the publishing capability matrix (`release matrix verify`) for missing,
 * duplicate, or incomplete capability rows.
 */
import { Env } from '@kitz/env'
import { Console, Effect, HashSet } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Publisher from '../../api/publishing/__.js'

const matrixVerify = Command.make(
  'verify',
  {
    latest: Flag.boolean('latest').pipe(
      Flag.withDescription('Report latest-mode behavior'),
      Flag.withDefault(false),
    ),
    write: Flag.boolean('write').pipe(
      Flag.withDescription('Report write-mode behavior'),
      Flag.withDefault(false),
    ),
  },
  ({ latest, write }) =>
    Effect.gen(function* () {
      const env = yield* Env.Env

      const capabilities = Publisher.Models.publishCapabilityValues
      const rows = Publisher.Models.capabilityMatrix
      const rowCapabilities = HashSet.fromIterable(rows.map((row) => row.capability))
      const missing = capabilities.filter((capability) => !HashSet.has(rowCapabilities, capability))
      const duplicateCount = rows.length - HashSet.size(rowCapabilities)
      const incomplete = rows.filter(
        (row) =>
          row.evidence.length === 0 ||
          row.conformance.length === 0 ||
          row.providers['npm'] === undefined ||
          row.providers['pnpm'] === undefined ||
          row.providers['bun'] === undefined,
      )

      if (missing.length > 0 || duplicateCount > 0 || incomplete.length > 0) {
        yield* Console.error('Publishing capability matrix failed verification.')
        for (const capability of missing) yield* Console.error(`missing row: ${capability}`)
        if (duplicateCount > 0) yield* Console.error(`duplicate rows: ${String(duplicateCount)}`)
        for (const row of incomplete) yield* Console.error(`incomplete row: ${row.capability}`)
        return env.exit(1)
      }

      yield* Console.log(`Publishing capability matrix verified (${rows.length} capabilities).`)
      if (latest) {
        yield* Console.log('Latest mode: no live mutation is performed by matrix verification.')
        yield* Console.log(`Write mode: ${write ? 'enabled' : 'disabled'}`)
      }
    }),
).pipe(Command.withDescription('Verify the publishing capability matrix'))

export const matrix = Command.make('matrix').pipe(
  Command.withDescription('Verify the publishing capability matrix'),
  Command.withSubcommands([matrixVerify]),
  Command.provide(Env.Live),
)
