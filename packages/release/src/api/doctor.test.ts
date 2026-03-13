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
          report: new Report({
            results: [
              new Finished({
                rule: ruleRef(
                  'env.release-branch-allowed',
                  'active branch is allowed for the planned release lifecycle',
                ),
                duration: 2,
                severity: new Severity.Error(),
                violation: new Violation({
                  location: new Environment({
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
          required: false,
          reason: 'PR number is not available in this environment.',
        },
      ],
    }

    const output = formatEvaluation(evaluation)

    expect(output).toContain('Current branch: feat/release')
    expect(output).toContain('Scope: computed lifecycle scenarios')
    expect(output).toContain('Official')
    expect(output).toContain('Planned packages: 3')
    expect(output).toContain('1 rules checked')
    expect(output).toContain('Ephemeral')
    expect(output).toContain('Unavailable: PR number is not available in this environment.')
    expect(hasBlockingIssues(evaluation)).toBe(true)
  })
})
