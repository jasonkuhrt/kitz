import { Str } from '@kitz/core'
import { formatReport } from './lint/ops/relay.js'
import { Finished, type Report } from './lint/models/report.js'
import * as Severity from './lint/models/severity.js'
import type { Plan } from './planner/models/plan.js'
import { createTerminalTheme, type TerminalFormatOptions } from '../terminal.js'
import type { Lifecycle } from './version/models/lifecycle.js'

export interface RequestedLifecycle {
  readonly lifecycle: Lifecycle
  readonly required: boolean
}

export interface SelectRequestedLifecyclesOptions {
  readonly lifecycle?: Lifecycle
  readonly all?: boolean
  readonly hasPrContext: boolean
}

export const selectRequestedLifecycles = (
  options: SelectRequestedLifecyclesOptions,
): readonly RequestedLifecycle[] => {
  if (options.lifecycle) return [{ lifecycle: options.lifecycle, required: true }]
  if (options.all) {
    return [
      { lifecycle: 'official', required: true },
      { lifecycle: 'candidate', required: true },
      { lifecycle: 'ephemeral', required: true },
    ]
  }

  return [
    { lifecycle: 'official', required: true },
    { lifecycle: 'candidate', required: true },
    ...(options.hasPrContext ? ([{ lifecycle: 'ephemeral', required: true }] as const) : []),
  ]
}

export interface ResolveDoctorScopeOptions extends SelectRequestedLifecyclesOptions {
  readonly activePlan?: Plan
}

export type DoctorScope =
  | {
      readonly _tag: 'ActivePlanScope'
      readonly plan: Plan
    }
  | {
      readonly _tag: 'LifecycleScope'
      readonly lifecycles: readonly RequestedLifecycle[]
    }

export const resolveScope = (options: ResolveDoctorScopeOptions): DoctorScope => {
  if (options.lifecycle || options.all) {
    return {
      _tag: 'LifecycleScope',
      lifecycles: selectRequestedLifecycles(options),
    }
  }

  if (options.activePlan) {
    return {
      _tag: 'ActivePlanScope',
      plan: options.activePlan,
    }
  }

  return {
    _tag: 'LifecycleScope',
    lifecycles: selectRequestedLifecycles(options),
  }
}

export interface CheckedLifecycleReport {
  readonly _tag: 'CheckedLifecycleReport'
  readonly lifecycle: Lifecycle
  readonly required: boolean
  readonly plannedPackages: number
  readonly report: Report
}

export interface UnavailableLifecycleReport {
  readonly _tag: 'UnavailableLifecycleReport'
  readonly lifecycle: Lifecycle
  readonly required: boolean
  readonly reason: string
}

export type LifecycleReport = CheckedLifecycleReport | UnavailableLifecycleReport

export interface DoctorEvaluation {
  readonly currentBranch: string
  readonly trunk: string
  readonly scope: string
  readonly reports: readonly LifecycleReport[]
}

const titleForLifecycle = (lifecycle: Lifecycle): string =>
  lifecycle.charAt(0).toUpperCase() + lifecycle.slice(1)

const hasErrorViolations = (report: Report): boolean =>
  report.results.some(
    (result) =>
      Finished.is(result) &&
      result.violation !== undefined &&
      Severity.Severity.guards.SeverityError(result.severity),
  )

export const hasBlockingIssues = (evaluation: DoctorEvaluation): boolean =>
  evaluation.reports.some((report) =>
    report._tag === 'UnavailableLifecycleReport'
      ? report.required
      : hasErrorViolations(report.report),
  )

export const formatEvaluation = (
  evaluation: DoctorEvaluation,
  options?: TerminalFormatOptions,
): string => {
  const output = Str.Builder()
  const theme = createTerminalTheme(options)

  output(theme.heading('Doctor Report'))
  output(theme.dim('-----------'))
  output`${theme.key('Current branch')} ${theme.code(evaluation.currentBranch)}`
  output`${theme.key('Trunk branch')} ${theme.code(evaluation.trunk)}`
  output`${theme.key('Scope')} ${evaluation.scope}`
  output`${theme.key('Lifecycle checks')} ${String(evaluation.reports.length)}`

  for (const report of evaluation.reports) {
    output``
    output(theme.section(titleForLifecycle(report.lifecycle)))

    if (report._tag === 'UnavailableLifecycleReport') {
      output`${theme.badge(report.required ? 'error' : 'deferred', 'UNAVAILABLE')} ${report.reason}`
      continue
    }

    output`${theme.key('Planned packages')} ${String(report.plannedPackages)}`
    output(
      formatReport(report.report, {
        includeTitle: false,
        color: theme.color,
      }),
    )
  }

  return output.render()
}
