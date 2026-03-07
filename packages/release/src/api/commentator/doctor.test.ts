import { describe, expect, test } from 'vitest'
import { Finished, Report } from '../lint/models/report.js'
import { RuleId } from '../lint/models/rule-defaults.js'
import * as Severity from '../lint/models/severity.js'
import { DocLink, Hint, Violation } from '../lint/models/violation.js'
import { Environment } from '../lint/models/violation-location.js'
import { createDoctorSummary, renderDoctorSummary } from './doctor.js'

const ruleRef = (id: string, description: string) => ({
  id: RuleId.make(id),
  description,
})

describe('commentator doctor', () => {
  test('renders a doctor table and guidance from lint results', () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef(
            'env.publish-channel-ready',
            'declared publish channel matches the active runtime',
          ),
          duration: 1,
          severity: Severity.Error.make(),
          metadata: {
            status: 'deferred',
            mode: 'github-token',
            workflow: 'publish-pr.yml',
            activeWorkflow: 'pr.yml',
            tokenEnv: 'NPM_TOKEN',
          },
        }),
        Finished.make({
          rule: ruleRef(
            'pr.projected-squash-commit-sync',
            'PR title header matches the canonical squash-merge header',
          ),
          duration: 1,
          severity: Severity.Warn.make(),
          metadata: { projectedHeader: 'feat(release)' },
        }),
        Finished.make({
          rule: ruleRef('plan.packages-license-present', 'planned packages declare a license'),
          duration: 1,
          severity: Severity.Warn.make(),
          metadata: { packageCount: 2 },
        }),
        Finished.make({
          rule: ruleRef(
            'plan.packages-repository-match-canonical',
            'planned package repository metadata points at the canonical GitHub repo',
          ),
          duration: 1,
          severity: Severity.Warn.make(),
          violation: Violation.make({
            location: Environment.make({ message: 'repository mismatch' }),
            summary: 'Repository metadata should point at jasonkuhrt/kitz.',
            detail: 'Trusted publishing expects package manifests to point back to the same repo.',
            hints: [
              Hint.make({
                description: 'Set repository.url to git+https://github.com/jasonkuhrt/kitz.git.',
              }),
            ],
            docs: [
              DocLink.make({
                label: 'npm trusted publishers',
                url: 'https://docs.npmjs.com/trusted-publishers/',
              }),
            ],
          }),
        }),
      ],
    })

    const summary = createDoctorSummary(report, {
      lifecycle: 'ephemeral',
      plannedPackages: 2,
      runbook: {
        title: 'Manual Preview Runbook',
        commands: ['pnpm release:build', 'PR_NUMBER=129 pnpm release:plan:ephemeral'],
      },
      deferredChecks: [
        {
          label: 'npm auth is configured (npm whoami succeeds)',
          ruleId: 'env.npm-authenticated',
          preventsDescriptions: ['npm publish failing because npm auth is missing'],
          checkCommand: 'pnpm release doctor --onlyRule env.npm-authenticated',
        },
      ],
    })

    expect(summary).toBeDefined()
    expect(summary?.rows[0]?.status).toBe('deferred')
    expect(summary?.rows[1]?.notes).toContain('feat(release)')

    const rendered = renderDoctorSummary(summary!)
    expect(rendered).toContain('### Doctor')
    expect(rendered).toContain('publish-pr.yml')
    expect(rendered).toContain('Release header')
    expect(rendered).toContain('Guidance (1)')
    expect(rendered).toContain('Repository provenance')
    expect(rendered).toContain('Manual Preview Runbook')
    expect(rendered).toContain('Could Still Go Wrong Locally')
  })
})
