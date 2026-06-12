import { Str } from '@kitz/core'
import { Flo } from '@kitz/flo'
import { describe, expect, test } from 'bun:test'
import { formatExecutionStatus, formatLifecycleEvent } from './execution.js'

const date = new Date('2026-01-01T00:00:00.000Z')

// The executor/renderer import-boundary policies formerly asserted here are
// enforced by the `kitz/module/boundary-contract` oxlint rule (see .oxlintrc.json).
describe('execution renderers', () => {
  test('formats lifecycle events into printable log lines', () => {
    expect(
      formatLifecycleEvent(
        Flo.Activity.Started.make({ activity: 'publish', timestamp: date, resumed: false }),
      ),
    ).toEqual({
      level: 'info',
      message: '  › Starting: publish',
    })
    expect(
      formatLifecycleEvent(
        Flo.Activity.Completed.make({
          activity: 'publish',
          timestamp: date,
          resumed: false,
          durationMs: 1,
        }),
      ),
    ).toEqual({
      level: 'info',
      message: '✓ Completed: publish',
    })
    expect(
      formatLifecycleEvent(
        Flo.Activity.Failed.make({ activity: 'publish', timestamp: date, error: 'boom' }),
      ),
    ).toEqual({
      level: 'error',
      message: '✗ Failed: publish - boom',
    })
    expect(
      formatLifecycleEvent(Flo.WorkflowEvent.Completed.make({ timestamp: date, durationMs: 1 })),
    ).toBeUndefined()
  })

  test('renders colored lifecycle events and workflow status summaries', () => {
    const completed = formatLifecycleEvent(
      Flo.Activity.Completed.make({
        activity: 'publish',
        timestamp: date,
        resumed: false,
        durationMs: 1,
      }),
      { color: true },
    )
    const status = formatExecutionStatus(
      {
        state: 'not-started',
        executionId: 'release-official:test',
        lifecycle: 'official',
        plannedPackages: ['@kitz/core'],
      },
      { color: true },
    )

    expect(completed?.message).toContain('\u001b[')
    expect(Str.Visual.strip(completed?.message ?? '')).toContain('Completed: publish')
    expect(status).toContain('\u001b[')
    expect(Str.Visual.strip(status)).toContain('Run `release apply` to start the workflow.')
  })

  test('renders failed workflow state details', () => {
    const rendered = formatExecutionStatus({
      state: 'failed',
      executionId: 'release-official:test',
      lifecycle: 'official',
      plannedPackages: ['@kitz/core'],
      detail: 'workflow crashed',
    })

    expect(rendered).toContain('Release workflow status:')
    expect(rendered).toContain('[FAILED]')
    expect(rendered).toContain('Execution ID: `release-official:test`')
    expect(rendered).toContain('Packages: @kitz/core')
    expect(rendered).toContain('Failure')
    expect(rendered).toContain('workflow crashed')
  })

  test('preserves custom plan paths in not-started next-step guidance', () => {
    const rendered = formatExecutionStatus(
      {
        state: 'not-started',
        executionId: 'release-official:test',
        lifecycle: 'official',
        plannedPackages: ['@kitz/core'],
      },
      {
        nextApplyCommand: 'release apply --from ./.release/custom-plan.json',
      },
    )

    expect(rendered).toContain('Run `release apply --from ./.release/custom-plan.json`')
  })

  test('renders suspended workflow details and resume guidance', () => {
    const status = {
      state: 'suspended' as const,
      executionId: 'release-official:test',
      lifecycle: 'official' as const,
      plannedPackages: ['@kitz/core'],
      detail: 'publish failed',
    }

    const rendered = formatExecutionStatus(status)
    expect(rendered).toContain('[SUSPENDED]')
    expect(rendered).toContain('Suspended on')
    expect(rendered).toContain('publish failed')
    expect(rendered).toContain('run `release resume`')

    expect(
      formatExecutionStatus(status, {
        resumeCommand: 'release resume --from ./.release/custom-plan.json',
      }),
    ).toContain('run `release resume --from ./.release/custom-plan.json`')
  })

  test('renders colored success summaries without changing the stripped text semantics', () => {
    const rendered = formatExecutionStatus(
      {
        state: 'succeeded',
        executionId: 'release-official:test',
        lifecycle: 'official',
        plannedPackages: ['@kitz/core'],
        summary: {
          releasedPackages: ['@kitz/core'],
          createdTags: ['@kitz/core@1.1.0'],
          createdGHReleases: ['@kitz/core v1.1.0'],
        },
      },
      { color: true },
    )

    expect(rendered).toContain('\u001b[')
    expect(Str.Visual.strip(rendered)).toContain('Created tags: @kitz/core@1.1.0')
  })
})
