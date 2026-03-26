import { FileSystem } from 'effect'
import type { PlatformError } from 'effect/PlatformError'
import { Console, Effect, Match } from 'effect'
import { Failed, Finished, type Report, Skipped } from '../models/report.js'
import * as Severity from '../models/severity.js'
import * as ViolationLocation from '../models/violation-location.js'
import { ViolationFix } from '../models/violation.js'

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

export interface FormatReportOptions {
  readonly includeTitle?: boolean
  readonly title?: string
}

/**
 * Format a doctor report as human-readable text.
 */
export const formatReport = (report: Report, options?: FormatReportOptions): string => {
  const lines: string[] = []
  const includeTitle = options?.includeTitle ?? true

  const passed = report.results.filter((r): r is Finished => Finished.is(r) && !r.violation)
  const violated = report.results.filter((r): r is Finished => Finished.is(r) && !!r.violation)
  const skipped = report.results.filter((r): r is Skipped => Skipped.is(r))
  const failed = report.results.filter((r): r is Failed => Failed.is(r))

  if (includeTitle) {
    lines.push(options?.title ?? 'Doctor Report')
    lines.push(`-----------`)
  }
  lines.push(`${report.results.length} rules checked`)
  lines.push(``)

  if (violated.length > 0) {
    lines.push(`Violations (${violated.length}):`)
    for (const result of violated) {
      const level = Severity.Severity.guards.SeverityError(result.severity) ? 'error' : 'warn'
      lines.push(`  - [${level}] ${result.rule.id}: ${result.rule.description}`)
      if (result.violation) {
        const location = formatLocation(result.violation.location)
        if (location) lines.push(`      at ${location}`)
        if (result.violation.summary) lines.push(`      ${result.violation.summary}`)
        if (result.violation.detail) lines.push(`      ${result.violation.detail}`)
        if (result.violation.fix) {
          lines.push(`      fix: ${result.violation.fix.summary}`)

          if (ViolationFix.guards.ViolationGuideFix(result.violation.fix)) {
            for (const [index, step] of result.violation.fix.steps.entries()) {
              lines.push(`      step ${String(index + 1)}: ${step.description}`)
            }
          }

          if (ViolationFix.guards.ViolationCommandFix(result.violation.fix)) {
            lines.push(`      command: ${result.violation.fix.command}`)
          }

          for (const doc of result.violation.fix.docs ?? []) {
            lines.push(`      fix docs: ${doc.label} ${doc.url}`)
          }
        }
        for (const hint of result.violation.hints ?? []) {
          lines.push(`      hint: ${hint.description}`)
        }
        for (const doc of result.violation.docs ?? []) {
          lines.push(`      docs: ${doc.label} ${doc.url}`)
        }
      }
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
      const errorMessage =
        result.error instanceof Error ? result.error.message : String(result.error)
      lines.push(`  - ${result.rule.id}: ${errorMessage}`)
    }
    lines.push(``)
  }

  return lines.join('\n')
}

const formatLocation = (location: ViolationLocation.ViolationLocation): string | undefined => {
  if (ViolationLocation.PrTitle.is(location)) {
    return `PR title "${location.title}"`
  }
  if (ViolationLocation.PrBody.is(location)) {
    return location.line ? `PR body line ${String(location.line)}` : 'PR body'
  }
  if (ViolationLocation.RepoSettings.is(location)) {
    return 'repository settings'
  }
  if (ViolationLocation.GitHistory.is(location)) {
    return `git history at ${location.sha}`
  }
  if (ViolationLocation.File.is(location)) {
    return location.line ? `${location.path}:${String(location.line)}` : location.path
  }
  if (ViolationLocation.Environment.is(location)) {
    return location.message
  }
  return undefined
}

const formatOutput = (report: Report, format: 'text' | 'json'): string =>
  Match.value(format).pipe(
    Match.when('json', () => JSON.stringify(report, null, 2)),
    Match.when('text', () => formatReport(report)),
    Match.exhaustive,
  )

/**
 * Output a doctor report to the specified destination.
 */
export const relay = (
  params: RelayParams,
): Effect.Effect<void, PlatformError, FileSystem.FileSystem> => {
  const { report, format = 'text', destination = Destination.stdout } = params
  const output = formatOutput(report, format)

  return Match.value(destination).pipe(
    Match.when({ _tag: 'stdout' }, () => Console.log(output)),
    Match.when({ _tag: 'file' }, ({ path }) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString(path, output)
      }),
    ),
    Match.exhaustive,
  )
}
