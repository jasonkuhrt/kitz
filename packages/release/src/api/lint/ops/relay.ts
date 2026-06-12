import { Cli } from '@kitz/cli'
import { Err, Str } from '@kitz/core'
import { PlatformError, FileSystem } from 'effect'
import { Console, Effect, Match } from 'effect'
import { Failed, Finished, type Report, Skipped } from '../models/report.js'
import { ViolationLocation } from '../models/violation-location.js'
import { ViolationFix } from '../models/violation.js'
import { PreconditionsNotMetError } from './check.js'

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
  readonly color?: boolean
}

/**
 * Format a doctor report as human-readable text.
 */
export const formatReport = (report: Report, options?: FormatReportOptions): string => {
  const output = Str.Builder()
  const includeTitle = options?.includeTitle ?? true
  const theme = Cli.Terminal.createTerminalTheme(
    options?.color === undefined ? undefined : { color: options.color },
  )

  const passed = report.results.filter((r): r is Finished => Finished.is(r) && !r.violation)
  const violated = report.results.filter((r): r is Finished => Finished.is(r) && !!r.violation)
  const skipped = report.results.filter((r): r is Skipped => Skipped.is(r))
  const failed = report.results.filter((r): r is Failed => Failed.is(r))

  if (includeTitle) {
    output(theme.heading(options?.title ?? 'Doctor Report'))
    output(theme.dim(`-----------`))
  }
  output`${theme.key('Rules checked')} ${String(report.results.length)}`

  if (violated.length > 0) {
    output``
    output(theme.section(`Violations (${violated.length})`))
    for (const result of violated) {
      const level = result.severity
      output(
        `  ${theme.badge(level, level.toUpperCase())} ${theme.code(result.rule.id)} ${theme.dim(result.rule.description)}`,
      )
      if (result.violation) {
        const location = formatLocation(result.violation.location)
        if (location) output(`      ${theme.key('at')} ${location}`)
        if (result.violation.summary) output(`      ${result.violation.summary}`)
        if (result.violation.detail) output(`      ${result.violation.detail}`)
        if (result.violation.fix) {
          output(`      ${theme.key('fix')} ${result.violation.fix.summary}`)

          if (ViolationFix.guards.ViolationGuideFix(result.violation.fix)) {
            for (const [index, step] of result.violation.fix.steps.entries()) {
              output(`      ${theme.key(`step ${String(index + 1)}`)} ${step.description}`)
            }
          }

          if (ViolationFix.guards.ViolationCommandFix(result.violation.fix)) {
            output(`      ${theme.key('command')} ${theme.code(result.violation.fix.command)}`)
          }

          for (const doc of result.violation.fix.docs ?? []) {
            output(`      ${theme.key('fix docs')} ${doc.label} ${theme.url(doc.url)}`)
          }
        }
        for (const hint of result.violation.hints ?? []) {
          output(`      ${theme.key('hint')} ${hint.description}`)
        }
        for (const doc of result.violation.docs ?? []) {
          output(`      ${theme.key('docs')} ${doc.label} ${theme.url(doc.url)}`)
        }
      }
    }
  }

  if (passed.length > 0) {
    output``
    output(theme.section(`Passed (${passed.length})`))
    for (const result of passed) {
      output(
        `  ${theme.badge('success', 'PASS')} ${theme.code(result.rule.id)} ${theme.dim(`(${result.duration.toFixed(1)}ms)`)}`,
      )
    }
  }

  if (skipped.length > 0) {
    output``
    output(theme.section(`Skipped (${skipped.length})`))
    for (const result of skipped) {
      output(`  ${theme.badge('info', 'SKIP')} ${theme.code(result.rule.id)}`)
    }
  }

  if (failed.length > 0) {
    output``
    output(theme.section(`Errors (${failed.length})`))
    for (const result of failed) {
      output(
        `  ${theme.badge('error', 'FAIL')} ${theme.code(result.rule.id)} ${formatFailedError(result.error)}`,
      )
    }
  }

  return output.render()
}

const formatLocation = ViolationLocation.match({
  ViolationLocationPrTitle: (location) => `PR title "${location.title}"`,
  ViolationLocationPrBody: (location) =>
    location.line ? `PR body line ${String(location.line)}` : 'PR body',
  ViolationLocationRepoSettings: () => 'repository settings',
  ViolationLocationGitHistory: (location) => `git history at ${location.sha}`,
  ViolationLocationFile: (location) =>
    location.line ? `${location.path}:${String(location.line)}` : location.path,
  ViolationLocationEnvironment: (location) => location.message,
})

/** Render the stored error of a {@link Failed} result as a single line. */
const formatFailedError = (error: unknown): string => {
  if (error instanceof PreconditionsNotMetError) {
    // The rule id is already printed on the line; show only the failed preconditions.
    return `Preconditions not met: ${error.context.failed.join(', ')}`
  }
  return Err.ensure(error).message
}

const formatOutput = (
  report: Report,
  format: 'text' | 'json',
  options?: { readonly color?: boolean },
): string =>
  Match.value(format).pipe(
    Match.when('json', () => JSON.stringify(report, null, 2)),
    Match.when('text', () => formatReport(report, options)),
    Match.exhaustive,
  )

/**
 * Output a doctor report to the specified destination.
 */
export const relay = (
  params: RelayParams,
): Effect.Effect<void, PlatformError.PlatformError, FileSystem.FileSystem> => {
  const { report, format = 'text', destination = Destination.stdout } = params
  const output = formatOutput(report, format, {
    color: destination._tag === 'stdout',
  })

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
