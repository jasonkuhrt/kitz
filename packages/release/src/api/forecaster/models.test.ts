import { Semver } from '@kitz/semver'
import { Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { CommitDisplay, Forecast, ForecastCascade, ForecastRelease } from './models.js'

describe('CommitDisplay', () => {
  test('make and is()', () => {
    const c = new CommitDisplay({
      shortSha: 'abc1234',
      subject: 'add feature',
      type: 'feat',
      breaking: false,
      commitUrl: 'https://github.com/org/repo/commit/abc1234',
    })
    expect(c._tag).toBe('CommitDisplay')
    expect(CommitDisplay.is(c)).toBe(true)
  })

  test('schema roundtrip', () => {
    const c = new CommitDisplay({
      shortSha: 'abc1234',
      subject: 'breaking change',
      type: 'feat',
      breaking: true,
      commitUrl: 'https://github.com/org/repo/commit/abc1234',
    })
    const encoded = Schema.encodeSync(CommitDisplay)(c)
    const decoded = Schema.decodeSync(CommitDisplay)(encoded)
    expect(decoded.shortSha).toBe('abc1234')
    expect(decoded.breaking).toBe(true)
  })
})

describe('ForecastRelease', () => {
  const makeRelease = () =>
    new ForecastRelease({
      packageName: '@kitz/core',
      packageScope: 'core',
      bump: 'minor',
      currentVersion: Option.some(Semver.fromString('1.0.0')),
      nextOfficialVersion: Semver.fromString('1.1.0'),
      commits: [
        new CommitDisplay({
          shortSha: 'abc1234',
          subject: 'add feature',
          type: 'feat',
          breaking: false,
          commitUrl: 'https://github.com/org/repo/commit/abc1234',
        }),
      ],
      sourceUrl: 'https://github.com/org/repo/tree/main/packages/core',
    })

  test('make and is()', () => {
    const r = makeRelease()
    expect(r._tag).toBe('ForecastRelease')
    expect(ForecastRelease.is(r)).toBe(true)
  })

  test('currentVersionDisplay with existing version', () => {
    const r = makeRelease()
    expect(r.currentVersionDisplay).toBe('1.0.0')
  })

  test('currentVersionDisplay for new package', () => {
    const r = new ForecastRelease({
      packageName: '@kitz/core',
      packageScope: 'core',
      bump: 'minor',
      currentVersion: Option.none(),
      nextOfficialVersion: Semver.fromString('0.1.0'),
      commits: [],
      sourceUrl: '',
    })
    expect(r.currentVersionDisplay).toBe('new')
  })

  test('schema roundtrip', () => {
    const r = makeRelease()
    const encoded = Schema.encodeSync(ForecastRelease)(r)
    const decoded = Schema.decodeSync(ForecastRelease)(encoded)
    expect(decoded.packageName).toBe('@kitz/core')
    expect(decoded.bump).toBe('minor')
  })
})

describe('ForecastCascade', () => {
  test('make and is()', () => {
    const c = new ForecastCascade({
      packageName: '@kitz/cli',
      packageScope: 'cli',
      currentVersion: Option.some(Semver.fromString('2.0.0')),
      nextOfficialVersion: Semver.fromString('2.0.1'),
      triggeredBy: ['@kitz/core'],
      sourceUrl: 'https://github.com/org/repo/tree/main/packages/cli',
    })
    expect(c._tag).toBe('ForecastCascade')
    expect(ForecastCascade.is(c)).toBe(true)
  })

  test('schema roundtrip', () => {
    const c = new ForecastCascade({
      packageName: '@kitz/cli',
      packageScope: 'cli',
      currentVersion: Option.none(),
      nextOfficialVersion: Semver.fromString('0.0.1'),
      triggeredBy: [],
      sourceUrl: '',
    })
    const encoded = Schema.encodeSync(ForecastCascade)(c)
    const decoded = Schema.decodeSync(ForecastCascade)(encoded)
    expect(decoded.packageName).toBe('@kitz/cli')
  })
})

describe('Forecast', () => {
  test('make and is()', () => {
    const f = new Forecast({
      owner: 'org',
      repo: 'repo',
      branch: 'main',
      headSha: 'abc1234',
      releases: [],
      cascades: [],
    })
    expect(f._tag).toBe('Forecast')
    expect(Forecast.is(f)).toBe(true)
  })

  test('schema roundtrip with releases and cascades', () => {
    const f = new Forecast({
      owner: 'org',
      repo: 'repo',
      branch: 'main',
      headSha: 'abc1234',
      releases: [
        new ForecastRelease({
          packageName: '@kitz/core',
          packageScope: 'core',
          bump: 'patch',
          currentVersion: Option.some(Semver.fromString('1.0.0')),
          nextOfficialVersion: Semver.fromString('1.0.1'),
          commits: [],
          sourceUrl: '',
        }),
      ],
      cascades: [
        new ForecastCascade({
          packageName: '@kitz/cli',
          packageScope: 'cli',
          currentVersion: Option.some(Semver.fromString('1.0.0')),
          nextOfficialVersion: Semver.fromString('1.0.1'),
          triggeredBy: ['@kitz/core'],
          sourceUrl: '',
        }),
      ],
    })

    const encoded = Schema.encodeSync(Forecast)(f)
    const decoded = Schema.decodeSync(Forecast)(encoded)
    expect(decoded.releases).toHaveLength(1)
    expect(decoded.cascades).toHaveLength(1)
    expect(decoded.owner).toBe('org')
  })
})
