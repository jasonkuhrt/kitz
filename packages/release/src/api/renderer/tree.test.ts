import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { CommitDisplay, Forecast, ForecastCascade, ForecastRelease } from '../forecaster/models.js'
import { renderTree } from './tree.js'

// ── Helpers ──────────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────

describe('renderTree', () => {
  test('empty forecast', () => {
    const output = renderTree(emptyForecast)
    expect(output).toContain('0 packages')
    expect(output).toContain('primary (0)')
  })

  test('single primary release', () => {
    const f = remakeForecast(emptyForecast, {
      releases: [makeRelease('@kitz/core', 'core', 'minor')],
    })
    const output = renderTree(f)
    expect(output).toContain('1 packages')
    expect(output).toContain('primary (1)')
    expect(output).toContain('@kitz/core')
    expect(output).toContain('1 commit')
  })

  test('multiple primary releases sorted by commit count', () => {
    const f = remakeForecast(emptyForecast, {
      releases: [
        makeRelease('@kitz/core', 'core', 'minor', [makeCommit('aaa', 'feat', 'a')]),
        makeRelease('@kitz/cli', 'cli', 'patch', [
          makeCommit('bbb', 'fix', 'b'),
          makeCommit('ccc', 'fix', 'c'),
          makeCommit('ddd', 'fix', 'd'),
        ]),
      ],
    })
    const output = renderTree(f)
    // cli has 3 commits, should appear first
    const cliIdx = output.indexOf('@kitz/cli')
    const coreIdx = output.indexOf('@kitz/core')
    expect(cliIdx).toBeLessThan(coreIdx)
  })

  test('with cascades shows cascade section', () => {
    const f = remakeForecast(emptyForecast, {
      releases: [makeRelease('@kitz/core', 'core', 'minor')],
      cascades: [makeCascade('@kitz/cli', 'cli', ['@kitz/core'])],
    })
    const output = renderTree(f)
    expect(output).toContain('2 packages')
    expect(output).toContain('cascades (1)')
    expect(output).toContain('@kitz/cli')
    expect(output).toContain('via @kitz/core')
  })

  test('maxItems truncation', () => {
    const f = remakeForecast(emptyForecast, {
      releases: [
        makeRelease('@kitz/core', 'core', 'minor'),
        makeRelease('@kitz/cli', 'cli', 'patch'),
        makeRelease('@kitz/utils', 'utils', 'patch'),
      ],
    })
    const output = renderTree(f, { maxItems: 1 })
    expect(output).toContain('... 2 more')
  })

  test('breaking commit shown with !', () => {
    const f = remakeForecast(emptyForecast, {
      releases: [
        makeRelease('@kitz/core', 'core', 'major', [
          makeCommit('abc1234', 'feat', 'remove old API', true),
        ]),
      ],
    })
    const output = renderTree(f)
    expect(output).toContain('feat!')
  })
})
