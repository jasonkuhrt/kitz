import { Cli } from '@kitz/cli'
import { Str } from '@kitz/core'
import type { Flo } from '@kitz/flo'
import { Match } from 'effect'
import type { ExecutionStatus } from '../executor/execute.js'

export interface LifecycleEventLine {
  readonly level: 'info' | 'error'
  readonly message: string
}

const executionStateTone = (state: ExecutionStatus['state']) => {
  switch (state) {
    case 'failed':
      return 'error' as const
    case 'not-started':
      return 'info' as const
    case 'succeeded':
      return 'success' as const
    case 'suspended':
      return 'warn' as const
  }
}

export interface FormatExecutionStatusOptions extends Cli.Terminal.TerminalFormatOptions {
  readonly nextApplyCommand?: string
  readonly resumeCommand?: string
}

export const formatExecutionStatus = (
  status: ExecutionStatus,
  options?: FormatExecutionStatusOptions,
): string => {
  const output = Str.Builder()
  const theme = Cli.Terminal.createTerminalTheme(options)

  output(
    `${theme.heading('Release workflow status:')} ${theme.badge(
      executionStateTone(status.state),
      status.state.toUpperCase(),
    )}`,
  )
  output`${theme.key('Execution ID')} ${theme.code(status.executionId)}`
  output`${theme.key('Lifecycle')} ${theme.code(status.lifecycle)}`
  output`${theme.key('Packages')} ${status.plannedPackages.join(', ') || '(none)'}`

  if (status.state === 'not-started') {
    output``
    output`No persisted workflow state exists for this plan yet.`
    output`${theme.key('Next')} Run ${theme.code(options?.nextApplyCommand ?? 'release apply')} to start the workflow.`
    return output.render()
  }

  if (status.state === 'suspended') {
    if (status.detail) {
      output``
      output(theme.section('Suspended on'))
      output(status.detail)
    }
    output``
    output(
      `${theme.key('Resume')} Fix the blocking issue, then run ${theme.code(options?.resumeCommand ?? 'release resume')} with the same plan.`,
    )
    return output.render()
  }

  if (status.state === 'failed') {
    output``
    output(theme.section('Failure'))
    output(status.detail)
    return output.render()
  }

  output``
  output(theme.section('Completed'))
  output`${theme.key('Released packages')} ${status.summary.releasedPackages.join(', ') || '(none)'}`
  output`${theme.key('Created tags')} ${status.summary.createdTags.join(', ') || '(none)'}`
  output`${theme.key('GitHub releases')} ${status.summary.createdGHReleases.join(', ') || '(none)'}`
  return output.render()
}

export const formatLifecycleEvent = (
  event: Flo.LifecycleEvent,
  options?: Cli.Terminal.TerminalFormatOptions,
): LifecycleEventLine | undefined => {
  const theme = Cli.Terminal.createTerminalTheme(options)

  return Match.value(event).pipe(
    Match.tags({
      ActivityStarted: (e): LifecycleEventLine => ({
        level: 'info',
        message: `  ${theme.info('›')} ${theme.key('Starting')} ${e.activity}`,
      }),
      ActivityCompleted: (e): LifecycleEventLine => ({
        level: 'info',
        message: `${theme.success('\u2713')} ${theme.key('Completed')} ${e.activity}`,
      }),
      ActivityFailed: (e): LifecycleEventLine => ({
        level: 'error',
        message: `${theme.error('\u2717')} ${theme.key('Failed')} ${e.activity} ${theme.dim('-')} ${e.error}`,
      }),
    }),
    Match.orElse(() => undefined),
  )
}
