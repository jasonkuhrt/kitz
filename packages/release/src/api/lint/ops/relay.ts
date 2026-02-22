import { FileSystem } from '@effect/platform'
import type { PlatformError } from '@effect/platform/Error'
import { Console, Effect, Match } from 'effect'
import { Failed, Finished, type Report, Skipped } from '../models/report.js'

export type Destination =
  | { readonly _tag: 'stdout' }
  | { readonly _tag: 'file'; readonly path: string }

export const Destination = {
  stdout: { _tag: 'stdout' } as Destination,
  file: (path: string): Destination => ({ _tag: 'file', path }),
}

export interface RelayParams {
  report: Report
  format?: 'text' | 'json' | undefined
  destination?: Destination
}

/**
 * Format a lint report as human-readable text.
 */
export const formatReport = (report: Report): string => {
  const lines: string[] = []

  const passed = report.results.filter((r): r is Finished => Finished.is(r) && !r.violation)
  const violated = report.results.filter((r): r is Finished => Finished.is(r) && !!r.violation)
  const skipped = report.results.filter((r): r is Skipped => Skipped.is(r))
  const failed = report.results.filter((r): r is Failed => Failed.is(r))

  lines.push(`Lint Report`)
  lines.push(`-----------`)
  lines.push(`${report.results.length} rules checked`)
  lines.push(``)

  if (violated.length > 0) {
    lines.push(`Violations (${violated.length}):`)
    for (const result of violated) {
      lines.push(`  - ${result.rule.id}: ${result.rule.description}`)
    }
    lines.push(``)
  }

  if (passed.length > 0) {
    lines.push(`Passed (${passed.length}):`)
    for (const result of passed) {
      lines.push(`  - ${result.rule.id} (${result.duration.toFixed(1)}ms)`)
    }
    lines.push(``)
  }

  if (skipped.length > 0) {
    lines.push(`Skipped (${skipped.length}):`)
    for (const result of skipped) {
      lines.push(`  - ${result.rule.id}`)
    }
    lines.push(``)
  }

  if (failed.length > 0) {
    lines.push(`Errors (${failed.length}):`)
    for (const result of failed) {
      const errorMessage = result.error instanceof Error ? result.error.message : String(result.error)
      lines.push(`  - ${result.rule.id}: ${errorMessage}`)
    }
    lines.push(``)
  }

  return lines.join('\n')
}

const formatOutput = (report: Report, format: 'text' | 'json'): string =>
  Match.value(format).pipe(
    Match.when('json', () => JSON.stringify(report, null, 2)),
    Match.when('text', () => formatReport(report)),
    Match.exhaustive,
  )

/**
 * Output a lint report to the specified destination.
 */
export const relay = (params: RelayParams): Effect.Effect<void, PlatformError, FileSystem.FileSystem> => {
  const { report, format = 'text', destination = Destination.stdout } = params
  const output = formatOutput(report, format)

  return Match.value(destination).pipe(
    Match.when({ _tag: 'stdout' }, () => Console.log(output)),
    Match.when({ _tag: 'file' }, ({ path }) =>
      Effect.gen(function*() {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString(path, output)
      })),
    Match.exhaustive,
  )
}
