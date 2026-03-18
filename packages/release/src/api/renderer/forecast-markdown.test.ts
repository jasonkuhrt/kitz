import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { CommitDisplay, Forecast, ForecastCascade, ForecastRelease } from '../forecaster/models.js'
import { renderForecastMarkdown } from './forecast-markdown.js'

const makeCommit = (sha: string, type: string, subject: string, breaking = false) =>
  CommitDisplay.make({
    shortSha: sha,
    subject,
    type,
    breaking,
    commitUrl: `https://github.com/org/repo/commit/${sha}`,
  })

const makeRelease = (
  name: string,
  scope: string,
  bump: Semver.BumpType,
  commits: CommitDisplay[] = [makeCommit('abc1234', 'feat', 'add feature')],
) =>
  ForecastRelease.make({
    packageName: name,
    packageScope: scope,
    bump,
    currentVersion: Option.some(Semver.fromString('1.0.0')),
    nextOfficialVersion: Semver.fromString('1.1.0'),
    commits,
    sourceUrl: `https://github.com/org/repo/tree/main/packages/${scope}`,
  })

const makeCascade = (name: string, scope: string, triggeredBy: string[]) =>
  ForecastCascade.make({
    packageName: name,
    packageScope: scope,
    currentVersion: Option.some(Semver.fromString('1.0.0')),
    nextOfficialVersion: Semver.fromString('1.0.1'),
    triggeredBy,
    sourceUrl: `https://github.com/org/repo/tree/main/packages/${scope}`,
  })

const makeForecast = (
  overrides: Partial<Pick<Forecast, 'releases' | 'cascades' | 'headSha'>> = {},
): Forecast =>
  Forecast.make({
    owner: 'org',
    repo: 'repo',
    branch: 'main',
    headSha: overrides.headSha ?? 'abc1234def5678',
    releases: overrides.releases ?? [],
    cascades: overrides.cascades ?? [],
  })

describe('renderForecastMarkdown', () => {
  test('renders a shareable markdown forecast summary with primary and cascade sections', () => {
    const output = renderForecastMarkdown(
      makeForecast({
        releases: [
          makeRelease('@kitz/core', 'core', 'minor', [
            makeCommit('abc1234', 'feat', 'add feature'),
            makeCommit('def5678', 'fix', 'patch issue'),
          ]),
        ],
        cascades: [makeCascade('@kitz/cli', 'cli', ['@kitz/core'])],
      }),
    )

    expect(output).toContain('## Release Forecast')
    expect(output).toContain('[`abc1234`](https://github.com/org/repo/commit/abc1234def5678)')
    expect(output).toContain('### Primary (1)')
    expect(output).toContain(
      '- [@kitz/core](https://github.com/org/repo/tree/main/packages/core) `1.0.0` -> `1.1.0` (`minor`, 2 commits)',
    )
    expect(output).toContain(
      '  - [`abc1234`](https://github.com/org/repo/commit/abc1234) feat: add feature',
    )
    expect(output).toContain('### Cascades (1)')
    expect(output).toContain(
      '- [@kitz/cli](https://github.com/org/repo/tree/main/packages/cli) `1.0.0` -> `1.0.1` via `@kitz/core`',
    )
  })

  test('includes publish metadata when available', () => {
    const output = renderForecastMarkdown(makeForecast(), {
      publishState: 'published',
      publishHistory: [
        {
          package: '@kitz/core',
          version: '1.1.0',
          iteration: 2,
          sha: 'abc1234def5678',
          timestamp: '2026-01-01T00:00:00Z',
          runId: 'run-1',
        },
      ],
    })

    expect(output).toContain('- Publish state: `published`')
    expect(output).toContain('- Publish history:')
    expect(output).toContain('`@kitz/core@1.1.0` iteration 2')
    expect(output).toContain('sha `abc1234`')
    expect(output).toContain('run `run-1`')
  })
})
