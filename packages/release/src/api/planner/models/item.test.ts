import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Semver } from '@kitz/semver'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { makeCascadeCommit } from '../../analyzer/models/commit.js'
import * as Version from '../../version/__.js'
import { OfficialFirst } from '../../version/models/official-first.js'
import { OfficialIncrement } from '../../version/models/official-increment.js'
import { Candidate } from './item-candidate.js'
import { Ephemeral } from './item-ephemeral.js'
import { Official } from './item-official.js'

const pkg = (name: string, scope: string) => ({
  name: Pkg.Moniker.parse(name),
  scope,
  path: Fs.Path.AbsDir.fromString(`/repo/packages/${scope}/`),
})

const commit = (scope: string) => makeCascadeCommit(scope, 'test commit')

// ── Official ─────────────────────────────────────────────────────────

describe('Official item', () => {
  test('nextVersion for increment', () => {
    const item = Official.make({
      package: pkg('@kitz/core', 'core'),
      version: OfficialIncrement.make({
        from: Semver.fromString('1.0.0'),
        to: Semver.fromString('1.1.0'),
        bump: 'minor',
      }),
      commits: [commit('core')],
    })
    expect(Semver.equivalence(item.nextVersion, Semver.fromString('1.1.0'))).toBe(true)
  })

  test('nextVersion for first release', () => {
    const item = Official.make({
      package: pkg('@kitz/core', 'core'),
      version: OfficialFirst.make({ version: Semver.fromString('0.1.0') }),
      commits: [commit('core')],
    })
    expect(Semver.equivalence(item.nextVersion, Semver.fromString('0.1.0'))).toBe(true)
  })

  test('currentVersion for increment', () => {
    const item = Official.make({
      package: pkg('@kitz/core', 'core'),
      version: OfficialIncrement.make({
        from: Semver.fromString('1.0.0'),
        to: Semver.fromString('1.1.0'),
        bump: 'minor',
      }),
      commits: [commit('core')],
    })
    expect(Option.isSome(item.currentVersion)).toBe(true)
    expect(Semver.equivalence(Option.getOrThrow(item.currentVersion), Semver.fromString('1.0.0'))).toBe(true)
  })

  test('currentVersion for first release is None', () => {
    const item = Official.make({
      package: pkg('@kitz/core', 'core'),
      version: OfficialFirst.make({ version: Semver.fromString('0.1.0') }),
      commits: [commit('core')],
    })
    expect(Option.isNone(item.currentVersion)).toBe(true)
  })

  test('bumpType for increment', () => {
    const item = Official.make({
      package: pkg('@kitz/core', 'core'),
      version: OfficialIncrement.make({
        from: Semver.fromString('1.0.0'),
        to: Semver.fromString('2.0.0'),
        bump: 'major',
      }),
      commits: [commit('core')],
    })
    expect(item.bumpType).toBe('major')
  })

  test('bumpType for first release is minor', () => {
    const item = Official.make({
      package: pkg('@kitz/core', 'core'),
      version: OfficialFirst.make({ version: Semver.fromString('0.1.0') }),
      commits: [commit('core')],
    })
    expect(item.bumpType).toBe('minor')
  })
})

// ── Candidate ────────────────────────────────────────────────────────

describe('Candidate item', () => {
  test('nextVersion includes prerelease', () => {
    const item = Candidate.make({
      package: pkg('@kitz/core', 'core'),
      baseVersion: Semver.fromString('1.1.0'),
      prerelease: Version.Candidate.make({ iteration: 3 }),
      commits: [commit('core')],
    })
    const version = Semver.toString(item.nextVersion)
    expect(version).toContain('next')
    expect(version).toContain('3')
  })

  test('currentVersion is base version', () => {
    const item = Candidate.make({
      package: pkg('@kitz/core', 'core'),
      baseVersion: Semver.fromString('1.1.0'),
      prerelease: Version.Candidate.make({ iteration: 1 }),
      commits: [commit('core')],
    })
    expect(Option.isSome(item.currentVersion)).toBe(true)
    expect(Semver.equivalence(Option.getOrThrow(item.currentVersion), Semver.fromString('1.1.0'))).toBe(true)
  })

  test('bumpType is undefined', () => {
    const item = Candidate.make({
      package: pkg('@kitz/core', 'core'),
      baseVersion: Semver.fromString('1.1.0'),
      prerelease: Version.Candidate.make({ iteration: 1 }),
      commits: [commit('core')],
    })
    expect(item.bumpType).toBeUndefined()
  })
})

// ── Ephemeral ────────────────────────────────────────────────────────

describe('Ephemeral item', () => {
  const sha = Git.Sha.make('abc1234')

  test('nextVersion includes PR metadata', () => {
    const item = Ephemeral.make({
      package: pkg('@kitz/core', 'core'),
      prerelease: Version.Ephemeral.make({ prNumber: 42, iteration: 1, sha }),
      commits: [commit('core')],
    })
    const version = Semver.toString(item.nextVersion)
    expect(version).toContain('pr')
    expect(version).toContain('42')
    expect(version).toContain('abc1234')
  })

  test('currentVersion is always None', () => {
    const item = Ephemeral.make({
      package: pkg('@kitz/core', 'core'),
      prerelease: Version.Ephemeral.make({ prNumber: 42, iteration: 1, sha }),
      commits: [commit('core')],
    })
    expect(Option.isNone(item.currentVersion)).toBe(true)
  })

  test('bumpType is undefined', () => {
    const item = Ephemeral.make({
      package: pkg('@kitz/core', 'core'),
      prerelease: Version.Ephemeral.make({ prNumber: 42, iteration: 1, sha }),
      commits: [commit('core')],
    })
    expect(item.bumpType).toBeUndefined()
  })
})
