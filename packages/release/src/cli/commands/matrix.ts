import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Console, Effect, HashSet } from 'effect'
import * as Api from '../../api/__.js'

Cli.run(Env.Live)(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const argv = yield* Cli.parseArgv(env.argv)
    const args = argv.args.slice(1)
    const action = args[0] ?? 'verify'
    if (action !== 'verify') {
      yield* Console.error('Usage: release matrix verify [--latest] [--write]')
      return env.exit(1)
    }

    const capabilities = Api.Publisher.Models.publishCapabilityValues
    const rows = Api.Publisher.Models.capabilityMatrix
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
    if (args.includes('--latest')) {
      yield* Console.log('Latest mode: no live mutation is performed by matrix verification.')
      yield* Console.log(`Write mode: ${args.includes('--write') ? 'enabled' : 'disabled'}`)
    }
  }),
)
