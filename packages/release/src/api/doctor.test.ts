import { Str } from '@kitz/core'
import { describe, expect, test } from 'vitest'
import { Finished, Report } from './lint/models/report.js'
import { RuleId } from './lint/models/rule-defaults.js'
import * as Severity from './lint/models/severity.js'
import { Violation } from './lint/models/violation.js'
import { Environment } from './lint/models/violation-location.js'
import {
  formatEvaluation,
  hasBlockingIssues,
  resolveScope,
  selectRequestedLifecycles,
} from './doctor.js'

const ruleRef = (id: string, description = 'Test rule') => ({
  id: RuleId.makeUnsafe(id),
  description,
})

describe('doctor api', () => {
  test('smart selection checks official and candidate by default, adding ephemeral only with PR context', () => {
    expect(selectRequestedLifecycles({ hasPrContext: false })).toEqual([
      { lifecycle: 'official', required: true },
      { lifecycle: 'candidate', required: true },
    ])

    expect(selectRequestedLifecycles({ hasPrContext: true })).toEqual([
      { lifecycle: 'official', required: true },
      { lifecycle: 'candidate', required: true },
      { lifecycle: 'ephemeral', required: true },
    ])
  })

  test('all selection includes every lifecycle', () => {
    expect(selectRequestedLifecycles({ all: true, hasPrContext: false })).toEqual([
      { lifecycle: 'official', required: true },
      { lifecycle: 'candidate', required: true },
      { lifecycle: 'ephemeral', required: true },
    ])
  })

  test('active plan becomes the default scope when no explicit selector is present', () => {
    expect(
      resolveScope({
        hasPrContext: false,
        activePlan: {
          _tag: 'Plan',
          lifecycle: 'candidate',
          timestamp: '',
          releases: [],
          cascades: [],
        },
      }),
    ).toEqual({
      _tag: 'ActivePlanScope',
      plan: {
        _tag: 'Plan',
        lifecycle: 'candidate',
        timestamp: '',
        releases: [],
        cascades: [],
      },
    })
  })

  test('explicit lifecycle selectors override active plans and empty smart scope still falls back to lifecycle scope', () => {
    expect(
      resolveScope({
        lifecycle: 'official',
        hasPrContext: true,
        activePlan: {
          _tag: 'Plan',
          lifecycle: 'candidate',
          timestamp: '',
          releases: [],
          cascades: [],
        },
      }),
    ).toEqual({
      _tag: 'LifecycleScope',
      lifecycles: [{ lifecycle: 'official', required: true }],
    })

    expect(resolveScope({ hasPrContext: false })).toEqual({
      _tag: 'LifecycleScope',
      lifecycles: [
        { lifecycle: 'official', required: true },
        { lifecycle: 'candidate', required: true },
      ],
    })
  })

  test('formats lifecycle sections and reports blocking issues', () => {
    const evaluation = {
      currentBranch: 'feat/release',
      trunk: 'main',
      scope: 'computed lifecycle scenarios',
      reports: [
        {
          _tag: 'CheckedLifecycleReport' as const,
          lifecycle: 'official' as const,
          required: true,
          plannedPackages: 3,
          report: Report.make({
            results: [
              Finished.make({
                rule: ruleRef(
                  'env.release-branch-allowed',
                  'active branch is allowed for the planned release lifecycle',
                ),
                duration: 2,
                severity: Severity.Error.make({}),
                violation: Violation.make({
                  location: Environment.make({
                    message:
                      'Current branch "feat/release" does not match configured trunk "main".',
                  }),
                }),
              }),
            ],
          }),
        },
        {
          _tag: 'UnavailableLifecycleReport' as const,
          lifecycle: 'ephemeral' as const,
          required: true,
          reason: 'PR number is not available in this environment.',
        },
      ],
    }

    const output = formatEvaluation(evaluation)

    expect(output).toContain('Current branch: `feat/release`')
    expect(output).toContain('Scope: computed lifecycle scenarios')
    expect(output).toContain('Official')
    expect(output).toContain('Planned packages: 3')
    expect(output).toContain('Rules checked: 1')
    expect(output).toContain('Ephemeral')
    expect(output).toContain('[UNAVAILABLE] PR number is not available in this environment.')
    expect(hasBlockingIssues(evaluation)).toBe(true)
  })

  test('supports non-blocking unavailable reports and colored doctor output', () => {
    const evaluation = {
      currentBranch: 'main',
      trunk: 'main',
      scope: 'computed lifecycle scenarios',
      reports: [
        {
          _tag: 'UnavailableLifecycleReport' as const,
          lifecycle: 'ephemeral' as const,
          required: false,
          reason: 'Preview-only lifecycle was skipped.',
        },
      ],
    }

    const output = formatEvaluation(evaluation, { color: true })

    expect(output).toContain('\u001b[')
    expect(Str.Visual.strip(output)).toContain('Preview-only lifecycle was skipped.')
    expect(hasBlockingIssues(evaluation)).toBe(false)
  })
})
