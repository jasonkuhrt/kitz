import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { CommitDisplay, Forecast, ForecastCascade, ForecastRelease } from '../forecaster/models.js'
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
    expect(output).toContain('<details><summary>Help</summary>')
    expect(output).toContain('| Packages | Summary line | Total packages in this forecast (`primary + cascades`). |')
    expect(output).toContain('| Head | Summary line | The exact commit SHA this forecast was computed from. |')
    expect(output).toContain('### Projected Release Header')
    expect(output).toContain('feat(cli, release)')
    expect(output).toContain('### Doctor')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('- [■]')
    expect(output).not.toContain('- [ ]')
  })

  test('renders publish history, status banners, and truncated commit links', () => {
    const output = render(
      Forecast.make({
        owner: 'org',
        repo: 'repo',
        branch: 'main',
        headSha: 'abc1234deadbee',
        releases: [
          ForecastRelease.make({
            packageName: '@kitz/core',
            packageScope: 'core',
            bump: 'minor',
            currentVersion: Option.some(Semver.fromString('1.0.0')),
            nextOfficialVersion: Semver.fromString('1.1.0'),
            commits: [
              CommitDisplay.make({
                shortSha: '1111111',
                subject: 'one',
                type: 'feat',
                breaking: false,
                commitUrl: 'https://github.com/org/repo/commit/1111111',
              }),
              CommitDisplay.make({
                shortSha: '2222222',
                subject: 'two',
                type: 'fix',
                breaking: false,
                commitUrl: 'https://github.com/org/repo/commit/2222222',
              }),
              CommitDisplay.make({
                shortSha: '3333333',
                subject: 'three',
                type: 'fix',
                breaking: false,
                commitUrl: 'https://github.com/org/repo/commit/3333333',
              }),
              CommitDisplay.make({
                shortSha: '4444444',
                subject: 'four',
                type: 'fix',
                breaking: false,
                commitUrl: 'https://github.com/org/repo/commit/4444444',
              }),
              CommitDisplay.make({
                shortSha: '5555555',
                subject: 'five',
                type: 'fix',
                breaking: false,
                commitUrl: 'https://github.com/org/repo/commit/5555555',
              }),
              CommitDisplay.make({
                shortSha: '6666666',
                subject: 'six',
                type: 'fix',
                breaking: false,
                commitUrl: 'https://github.com/org/repo/commit/6666666',
              }),
            ],
            sourceUrl: 'https://github.com/org/repo/tree/main/packages/core',
          }),
        ],
        cascades: [
          ForecastCascade.make({
            packageName: '@kitz/cli',
            packageScope: 'cli',
            currentVersion: Option.some(Semver.fromString('1.0.0')),
            nextOfficialVersion: Semver.fromString('1.0.1'),
            triggeredBy: ['@kitz/core'],
            sourceUrl: 'https://github.com/org/repo/tree/main/packages/cli',
          }),
        ],
      }),
      {
        publishState: 'failed',
        publishHistory: [
          {
            package: '@kitz/core',
            version: '0.0.0-pr.129.2.959738b',
            iteration: 2,
            sha: '959738b',
            timestamp: '2026-03-23T00:00:00.000Z',
            runId: '2',
          },
          {
            package: '@kitz/core',
            version: '0.0.0-pr.129.1.1234567',
            iteration: 1,
            sha: '1234567',
            timestamp: '2026-03-22T00:00:00.000Z',
            runId: '1',
          },
        ],
        interactiveChecklist: true,
      },
    )

    expect(output).toContain('<!-- publish-state:failed -->')
    expect(output).toContain('Publish failed')
    expect(output).toContain('Re-check a checkbox to retry')
    expect(output).toContain('published: [**`pr.129.2.959738b`**]')
    expect(output).toContain('`pr.129.1.1234567`')
    expect(output).toContain('+1')
    expect(output).toContain('### Cascades (1)')
    expect(output).toContain('via `@kitz/core`')
    expect(output).toContain('- [ ]')
  })

  test('renders unavailable and invalid projected release headers', () => {
    const output = render(forecast, {
      publishState: 'published',
      projectedSquashCommit: {
        actualTitle: 'not a commit title',
        actualHeader: null,
        actualTitleError: 'Missing colon separator',
        projectedHeader: 'feat(release)',
        inSync: false,
        reason: null,
      },
    })
    const unavailable = render(forecast, {
      publishState: 'publishing',
      projectedSquashCommit: {
        actualTitle: 'feat(release): polish',
        actualHeader: 'feat(release)',
        actualTitleError: null,
        projectedHeader: null,
        inSync: false,
        reason: null,
      },
    })

    expect(output).toContain('Published.')
    expect(output).toContain('Current PR title is not a valid conventional commit title')
    expect(unavailable).toContain('Publishing...')
    expect(unavailable).toContain('Unavailable: Could not project a release header.')
  })
})
