import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { CommitDisplay, Forecast, ForecastCascade, ForecastRelease } from '../forecaster/models.js'
import { renderTable } from './table.js'

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

const emptyForecast = Forecast.make({
  owner: 'org',
  repo: 'repo',
  branch: 'main',
  headSha: 'abc1234',
  releases: [],
  cascades: [],
})

const remakeForecast = (
  forecast: Forecast,
  overrides: Partial<Pick<Forecast, 'releases' | 'cascades'>>,
): Forecast =>
  Forecast.make({
    owner: forecast.owner,
    repo: forecast.repo,
    branch: forecast.branch,
    headSha: forecast.headSha,
    releases: overrides.releases ?? forecast.releases,
    cascades: overrides.cascades ?? forecast.cascades,
  })

describe('renderTable', () => {
  test('renders primary release table', () => {
    const forecast = remakeForecast(emptyForecast, {
      releases: [makeRelease('@kitz/core', 'core', 'minor')],
    })

    const output = renderTable(forecast)

    expect(output).toContain('release forecast')
    expect(output).toContain('Primary (1)')
    expect(output).toContain('Package')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('1.0.0')
    expect(output).toContain('1.1.0')
  })

  test('sorts primary releases by commit count descending', () => {
    const forecast = remakeForecast(emptyForecast, {
      releases: [
        makeRelease('@kitz/core', 'core', 'minor', [makeCommit('aaa', 'feat', 'a')]),
        makeRelease('@kitz/cli', 'cli', 'patch', [
          makeCommit('bbb', 'fix', 'b'),
          makeCommit('ccc', 'fix', 'c'),
          makeCommit('ddd', 'fix', 'd'),
        ]),
      ],
    })

    const output = renderTable(forecast)

    expect(output.indexOf('@kitz/cli')).toBeLessThan(output.indexOf('@kitz/core'))
  })

  test('renders cascade table when cascades exist', () => {
    const forecast = remakeForecast(emptyForecast, {
      releases: [makeRelease('@kitz/core', 'core', 'minor')],
      cascades: [makeCascade('@kitz/cli', 'cli', ['@kitz/core'])],
    })

    const output = renderTable(forecast)

    expect(output).toContain('Cascades (1)')
    expect(output).toContain('Triggered By')
    expect(output).toContain('@kitz/cli')
    expect(output).toContain('@kitz/core')
  })

  test('supports maxItems truncation for primary rows', () => {
    const forecast = remakeForecast(emptyForecast, {
      releases: [
        makeRelease('@kitz/core', 'core', 'minor'),
        makeRelease('@kitz/cli', 'cli', 'patch'),
        makeRelease('@kitz/utils', 'utils', 'patch'),
      ],
    })

    const output = renderTable(forecast, { maxItems: 1 })

    expect(output).toContain('... 2 more primary releases')
  })
})
