/**
 * @module cli/commands/matrix
 *
 * Verify the publishing capability matrix (`release matrix verify`) for missing,
 * duplicate, or incomplete capability rows.
 */
import { Str } from '@kitz/core'
import { Console, Effect, HashSet } from 'effect'
import { Command } from 'effect/unstable/cli'
import * as Publisher from '../../api/publishing/__.js'
import { CommandBaseLayer, failWith } from './_shared.js'

const matrixVerify = Command.make('verify', {}, () =>
  Effect.gen(function* () {
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
      const b = Str.Builder()
      b`Publishing capability matrix failed verification.`
      for (const capability of missing) {
        b`missing row: ${capability}`
      }
      b(duplicateCount > 0 ? `duplicate rows: ${String(duplicateCount)}` : null)
      for (const row of incomplete) {
        b`incomplete row: ${row.capability}`
      }
      return yield* failWith(b.render())
    }

    yield* Console.log(`Publishing capability matrix verified (${rows.length} capabilities).`)
  }),
).pipe(Command.withDescription('Verify the publishing capability matrix'))

export const matrix = Command.make('matrix').pipe(
  Command.withDescription('Verify the publishing capability matrix'),
  Command.withSubcommands([matrixVerify]),
  Command.provide(CommandBaseLayer),
)
