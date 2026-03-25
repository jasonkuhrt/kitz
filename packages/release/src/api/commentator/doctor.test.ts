import { describe, expect, test } from 'vitest'
import { Failed, Finished, Report, Skipped } from '../lint/models/report.js'
import { RuleId } from '../lint/models/rule-defaults.js'
import * as Severity from '../lint/models/severity.js'
import {
  CommandFix,
  DocLink,
  FixStep,
  GuideFix,
  Hint,
  Violation,
} from '../lint/models/violation.js'
import { Environment } from '../lint/models/violation-location.js'
import { createDoctorSummary, renderDoctorSummary } from './doctor.js'

const ruleRef = (id: string, description: string) => ({
  id: RuleId.makeUnsafe(id),
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
          severity: Severity.Error.make({}),
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
          severity: Severity.Warn.make({}),
          metadata: { projectedHeader: 'feat(release)' },
        }),
        Finished.make({
          rule: ruleRef(
            'pr.type.release-kind-match-diff',
            'No-release type cannot have src changes',
          ),
          duration: 1,
          severity: Severity.Warn.make({}),
        }),
        Finished.make({
          rule: ruleRef('plan.packages-license-present', 'planned packages declare a license'),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: { packageCount: 2 },
        }),
        Finished.make({
          rule: ruleRef(
            'plan.packages-repository-match-canonical',
            'planned package repository metadata points at the canonical GitHub repo',
          ),
          duration: 1,
          severity: Severity.Warn.make({}),
          violation: Violation.make({
            location: Environment.make({ message: 'repository mismatch' }),
            summary: 'Repository metadata should point at jasonkuhrt/kitz.',
            detail: 'Trusted publishing expects package manifests to point back to the same repo.',
            fix: CommandFix.make({
              summary: 'Apply the canonical PR title header.',
              command: 'release pr title apply',
            }),
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
        commands: [
          'bun run release:build',
          'PR_NUMBER=129 bun run release plan --lifecycle ephemeral',
        ],
        note: 'Publish from the canonical workflow after reviewing the preview output.',
      },
      deferredChecks: [
        {
          label: 'npm auth is configured (npm whoami succeeds)',
          ruleId: 'env.npm-authenticated',
          preventsDescriptions: ['npm publish failing because npm auth is missing'],
          checkCommand: 'bun run release doctor --onlyRule env.npm-authenticated',
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
    expect(rendered).toContain('Release kind')
    expect(rendered).toContain('Guidance (1)')
    expect(rendered).toContain('Repository provenance')
    expect(rendered).toContain('Fix: Apply the canonical PR title header.')
    expect(rendered).toContain('Command: `release pr title apply`')
    expect(rendered).toContain('Manual Preview Runbook')
    expect(rendered).toContain('Publish from the canonical workflow')
    expect(rendered).toContain('Could Still Go Wrong Locally')
  })

  test('renders manual, trusted, tag, failure, and skipped states in doctor summaries', () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef(
            'env.publish-channel-ready',
            'declared publish channel matches the active runtime',
          ),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: {
            status: 'manual',
            mode: 'manual',
          },
        }),
        Finished.make({
          rule: ruleRef(
            'plan.packages-repository-present',
            'planned packages declare repository metadata',
          ),
          duration: 1,
          severity: Severity.Warn.make({}),
        }),
        Finished.make({
          rule: ruleRef('plan.tags-unique', 'planned release tags are unique'),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: {
            conflictingTags: [],
            existingTags: ['@kitz/core@1.0.0'],
          },
        }),
        Finished.make({
          rule: ruleRef('plan.versions-unpublished', 'planned versions are not already published'),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: { packageCount: 3 },
        }),
        Finished.make({
          rule: ruleRef('plan.packages-repository-match-canonical', 'canonical repository matches'),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: { canonicalRepo: 'jasonkuhrt/kitz', packageCount: 3 },
        }),
        Finished.make({
          rule: ruleRef('pr.type.release-kind-match-diff', 'PR title kind matches changed files'),
          duration: 1,
          severity: Severity.Warn.make({}),
        }),
        Failed.make({
          rule: ruleRef('plan.packages-license-present', 'planned packages declare a license'),
          duration: 1,
          error: new Error('filesystem unavailable'),
        }),
        Skipped.make({
          rule: ruleRef('pr.projected-squash-commit-sync', 'release header'),
          reason: 'filtered',
        }),
      ],
    })

    const summary = createDoctorSummary(report, {
      lifecycle: 'official',
      plannedPackages: 2,
    })

    expect(summary).toBeDefined()
    expect(summary?.rows.map((row) => row.status)).toContain('manual')
    expect(summary?.rows.map((row) => row.notes).join('\n')).toContain(
      'Declared as manual. Merging does not publish automatically.',
    )
    expect(summary?.rows.map((row) => row.notes).join('\n')).toContain(
      'All 2 planned packages declare repository metadata.',
    )
    expect(summary?.rows.map((row) => row.notes).join('\n')).toContain(
      'No planned release tags collide with existing git tags.',
    )
    expect(summary?.rows.map((row) => row.notes).join('\n')).toContain(
      'All 3 planned package versions are still unpublished on npm.',
    )
    expect(summary?.rows.map((row) => row.notes).join('\n')).toContain(
      'All 3 planned packages point at `jasonkuhrt/kitz`.',
    )
    expect(summary?.rows.map((row) => row.notes).join('\n')).toContain(
      'PR title kind matches the changed source files.',
    )
    expect(summary?.rows.map((row) => row.notes).join('\n')).toContain('filesystem unavailable')
    expect(summary?.rows.some((row) => row.label === 'Release header')).toBe(false)
  })

  test('returns undefined when no doctor rows can be created', () => {
    const summary = createDoctorSummary(
      Report.make({
        results: [
          Skipped.make({
            rule: ruleRef('plan.tags-unique', 'planned release tags are unique'),
            reason: 'filtered',
          }),
        ],
      }),
      {
        lifecycle: 'candidate',
        plannedPackages: 1,
      },
    )

    expect(summary).toBeUndefined()
  })

  test('renders guide fixes and trusted-publishing readiness guidance', () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef(
            'env.publish-channel-ready',
            'declared publish channel matches the active runtime',
          ),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: {
            status: 'ready',
            mode: 'github-trusted',
            workflow: 'trunk.yml',
          },
        }),
        Finished.make({
          rule: ruleRef(
            'plan.packages-repository-match-canonical',
            'planned package repository metadata points at the canonical GitHub repo',
          ),
          duration: 1,
          severity: Severity.Error.make({}),
          violation: Violation.make({
            location: Environment.make({ message: 'repository mismatch' }),
            summary: 'Repository metadata needs an update.',
            fix: GuideFix.make({
              summary: 'Update package metadata.',
              steps: [
                FixStep.make({ description: 'Set repository.url to the canonical GitHub URL.' }),
                FixStep.make({ description: 'Republish the preview after regenerating metadata.' }),
              ],
              docs: [
                DocLink.make({
                  label: 'package.json repository',
                  url: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-json',
                }),
              ],
            }),
            hints: [Hint.make({ description: 'Keep every planned package on the same origin.' })],
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
      lifecycle: 'official',
      plannedPackages: 1,
    })
    const rendered = renderDoctorSummary(summary!)

    expect(summary?.rows[0]?.notes).toContain('Ready in `trunk.yml` via npm trusted publishing.')
    expect(rendered).toContain('Fix: Update package metadata.')
    expect(rendered).toContain('1. Set repository.url to the canonical GitHub URL.')
    expect(rendered).toContain('2. Republish the preview after regenerating metadata.')
    expect(rendered).toContain(
      'Fix docs: [package.json repository](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)',
    )
  })

  test('renders workflow-only deferred notes and command-fix docs', () => {
    const report = Report.make({
      results: [
        Finished.make({
          rule: ruleRef(
            'env.publish-channel-ready',
            'declared publish channel matches the active runtime',
          ),
          duration: 1,
          severity: Severity.Warn.make({}),
          metadata: {
            status: 'deferred',
            mode: 'github-token',
            workflow: 'publish.yml',
            tokenEnv: 'ALT_NPM_TOKEN',
          },
        }),
        Finished.make({
          rule: ruleRef('plan.tags-unique', 'planned release tags are unique'),
          duration: 1,
          severity: Severity.Error.make({}),
          violation: Violation.make({
            location: Environment.make({ message: 'tag already exists' }),
            summary: 'Release tags need attention.',
            fix: CommandFix.make({
              summary: 'Regenerate the release plan.',
              command: 'bun run release doctor --onlyRule plan.tags-unique',
              docs: [
                DocLink.make({
                  label: 'git tag basics',
                  url: 'https://git-scm.com/book/en/v2/Git-Basics-Tagging',
                }),
              ],
            }),
          }),
        }),
      ],
    })

    const summary = createDoctorSummary(report, {
      lifecycle: 'ephemeral',
      plannedPackages: 1,
    })
    const rendered = renderDoctorSummary(summary!)

    expect(summary?.rows[0]?.status).toBe('deferred')
    expect(summary?.rows[0]?.notes).toContain('this preview is not the publish job')
    expect(rendered).toContain('Command: `bun run release doctor --onlyRule plan.tags-unique`')
    expect(rendered).toContain(
      'Fix docs: [git tag basics](https://git-scm.com/book/en/v2/Git-Basics-Tagging)',
    )
  })

  test('defaults publish-channel status when metadata is absent and renders github-token readiness', () => {
    const defaultSummary = createDoctorSummary(
      Report.make({
        results: [
          Finished.make({
            rule: ruleRef(
              'env.publish-channel-ready',
              'declared publish channel matches the active runtime',
            ),
            duration: 1,
            severity: Severity.Warn.make({}),
          }),
        ],
      }),
      {
        lifecycle: 'candidate',
        plannedPackages: 1,
      },
    )

    const readySummary = createDoctorSummary(
      Report.make({
        results: [
          Finished.make({
            rule: ruleRef(
              'env.publish-channel-ready',
              'declared publish channel matches the active runtime',
            ),
            duration: 1,
            severity: Severity.Warn.make({}),
            metadata: {
              status: 'ready',
              mode: 'github-token',
              workflow: 'publish.yml',
              tokenEnv: 'ALT_NPM_TOKEN',
            },
          }),
        ],
      }),
      {
        lifecycle: 'official',
        plannedPackages: 1,
      },
    )

    expect(defaultSummary?.rows[0]).toEqual({
      label: 'Publish channel',
      status: 'pass',
      notes: 'Publish channel is ready.',
    })
    expect(readySummary?.rows[0]?.notes).toContain('Ready in `publish.yml` via `ALT_NPM_TOKEN`.')
  })

  test('uses default pass notes when projected metadata is absent', () => {
    const summary = createDoctorSummary(
      Report.make({
        results: [
          Finished.make({
            rule: ruleRef(
              'plan.versions-unpublished',
              'planned versions are not already published',
            ),
            duration: 1,
            severity: Severity.Warn.make({}),
          }),
          Finished.make({
            rule: ruleRef(
              'pr.projected-squash-commit-sync',
              'PR title header matches the canonical squash-merge header',
            ),
            duration: 1,
            severity: Severity.Warn.make({}),
          }),
        ],
      }),
      {
        lifecycle: 'ephemeral',
        plannedPackages: 2,
      },
    )

    expect(summary?.rows.map((row) => row.notes)).toContain(
      'All 2 planned package versions are still unpublished on npm.',
    )
    expect(summary?.rows.map((row) => row.notes)).toContain(
      'PR title header already matches the canonical release header.',
    )
  })
})
