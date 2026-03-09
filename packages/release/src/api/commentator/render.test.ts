import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { CommitDisplay, Forecast, ForecastRelease } from '../forecaster/models.js'
import { render } from './render.js'

const forecast = Forecast.make({
  owner: 'org',
  repo: 'repo',
  branch: 'main',
  headSha: 'abc1234',
  releases: [
    ForecastRelease.make({
      packageName: '@kitz/core',
      packageScope: 'core',
      bump: 'minor',
      currentVersion: Option.some(Semver.fromString('1.0.0')),
      nextOfficialVersion: Semver.fromString('1.1.0'),
      commits: [
        CommitDisplay.make({
          shortSha: 'abc1234',
          subject: 'new api',
          type: 'feat',
          breaking: false,
          commitUrl: 'https://github.com/org/repo/commit/abc1234',
        }),
      ],
      sourceUrl: 'https://github.com/org/repo/tree/main/packages/core',
    }),
  ],
  cascades: [],
})

describe('commentator render', () => {
  test('renders manual preview comments without misleading checkboxes', () => {
    const output = render(forecast, {
      interactiveChecklist: false,
      projectedSquashCommit: {
        actualTitle: 'feat(release, cli): polish',
        actualHeader: 'feat(release, cli)',
        actualTitleError: null,
        projectedHeader: 'feat(cli, release)',
        inSync: false,
        reason: null,
      },
      doctor: {
        lifecycle: 'ephemeral',
        rows: [
          {
            label: 'Publish channel',
            status: 'deferred',
            notes: 'Publishes from `publish-pr.yml`; this preview is running in `pr.yml`.',
          },
        ],
        guidance: [],
        deferredChecks: [],
      },
    })

    expect(output).toContain('<!-- kitz-release-plan -->')
    expect(output).toContain('## Release Forecast')
    expect(output).toContain('### Projected Release Header')
    expect(output).toContain('feat(cli, release)')
    expect(output).toContain('### Doctor')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('- [■]')
    expect(output).not.toContain('- [ ]')
  })
})
