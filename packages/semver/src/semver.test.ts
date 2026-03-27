import { Schema as S } from 'effect'
import { Test } from '@kitz/test'
import { describe, expect, test } from 'vitest'
import { Semver } from './_.js'

const pre = (
  ...ids: [string | number, ...(string | number)[]]
): Semver.PreRelease.PreRelease['prerelease'] => ids as Semver.PreRelease.PreRelease['prerelease']

// ─── Phase Detection ───────────────────────────────────────────────

Test.describe('isPhaseInitial')
  .on(Semver.isPhaseInitial)
  .cases(
    [[Semver.fromString('0.0.1')], true],
    [[Semver.fromString('0.1.0')], true],
    [[Semver.fromString('0.99.99')], true],
    [[Semver.fromString('1.0.0')], false],
    [[Semver.fromString('1.2.3')], false],
    [[Semver.fromString('2.0.0')], false],
  )
  .test()

Test.describe('isPhasePublic')
  .on(Semver.isPhasePublic)
  .cases(
    [[Semver.fromString('0.0.1')], false],
    [[Semver.fromString('0.1.0')], false],
    [[Semver.fromString('0.99.99')], false],
    [[Semver.fromString('1.0.0')], true],
    [[Semver.fromString('1.2.3')], true],
    [[Semver.fromString('2.0.0')], true],
  )
  .test()

// ─── mapBumpForPhase ───────────────────────────────────────────────

Test.describe('mapBumpForPhase > initial phase (0.x.x)')
  .on((bump: Semver.BumpType) => Semver.mapBumpForPhase(Semver.fromString('0.5.0'), bump))
  .cases(
    // In initial phase: major/minor → minor, patch → patch
    [['major'], 'minor'],
    [['minor'], 'minor'],
    [['patch'], 'patch'],
  )
  .test()

Test.describe('mapBumpForPhase > public phase (1.x.x+)')
  .on((bump: Semver.BumpType) => Semver.mapBumpForPhase(Semver.fromString('1.5.0'), bump))
  .cases(
    // In public phase: standard semantics
    [['major'], 'major'],
    [['minor'], 'minor'],
    [['patch'], 'patch'],
  )
  .test()

// ─── Pre-release Combinators ───────────────────────────────────────

Test.describe('officialToPre')
  .on(
    (
      version: Semver.OfficialRelease.OfficialRelease,
      prerelease: Semver.PreRelease.PreRelease['prerelease'],
    ) => Semver.officialToPre(version, { prerelease }).toString(),
  )
  .cases(
    [
      [
        Semver.OfficialRelease.OfficialRelease.make({ major: 1, minor: 2, patch: 3 }),
        pre('next', 1),
      ],
      '1.2.3-next.1',
    ],
    [
      [
        Semver.OfficialRelease.OfficialRelease.make({
          major: 1,
          minor: 2,
          patch: 3,
          build: ['build', '7'],
        }),
        pre('next', 2),
      ],
      '1.2.3-next.2+build.7',
    ],
    [
      [Semver.stripPre(Semver.fromString('1.2.3-beta.1+build.7')), pre('rc', 1)],
      '1.2.3-rc.1+build.7',
    ],
  )
  .test()

Test.describe('stripPre')
  .on((version: Semver.Semver) => Semver.stripPre(version).toString())
  .cases(
    [[Semver.fromString('1.2.3-next.1')], '1.2.3'],
    [[Semver.fromString('1.2.3-next.1+build.7')], '1.2.3+build.7'],
    [[Semver.fromString('1.2.3+build.7')], '1.2.3+build.7'],
  )
  .test()

Test.describe('withPre')
  .on(
    (
      version: Semver.Semver,
      prerelease: Semver.PreRelease.PreRelease['prerelease'],
      build?: Semver.PreRelease.PreRelease['build'],
    ) => Semver.withPre(version, prerelease, build).toString(),
  )
  .cases(
    [[Semver.fromString('1.2.3'), pre('next', 1)], '1.2.3-next.1'],
    [[Semver.fromString('1.2.3-beta.1+build.7'), pre('rc', 1)], '1.2.3-rc.1+build.7'],
    [[Semver.fromString('1.2.3+build.7'), pre('rc', 2), ['meta', '2']], '1.2.3-rc.2+meta.2'],
  )
  .test()

describe('Semver core combinators', () => {
  test('fromString accepts official releases, prereleases, build metadata, and loose prefixes', () => {
    expect(Semver.fromString('1.2.3').toString()).toBe('1.2.3')
    expect(Semver.fromString(' v1.2.3-next.4+build.7 ').toString()).toBe('1.2.3-next.4+build.7')
    expect(Semver.fromString('=2.0.0').toString()).toBe('2.0.0')
  })

  test('fromString rejects invalid semver text', () => {
    expect(() => Semver.fromString('1.2')).toThrow('Invalid semver format')
    expect(() => Semver.fromString('01.2.3')).toThrow('Invalid semver format')
  })

  test('Schema encodes semver values back to strings', () => {
    expect(S.encodeSync(Semver.Schema)(Semver.fromString('1.2.3-rc.1+meta.2'))).toBe(
      '1.2.3-rc.1+meta.2',
    )
  })

  test('ordering respects release precedence and prerelease identifier rules', () => {
    const alpha = Semver.fromString('1.2.3-alpha')
    const alpha1 = Semver.fromString('1.2.3-alpha.1')
    const alphaText = Semver.fromString('1.2.3-alpha.beta')
    const stable = Semver.fromString('1.2.3')

    expect(Semver.lessThan(alpha, alpha1)).toBe(true)
    expect(Semver.lessThan(alpha1, alphaText)).toBe(true)
    expect(Semver.lessThan(alphaText, stable)).toBe(true)
    expect(Semver.greaterThan(stable, alphaText)).toBe(true)
    expect(Semver.min(alpha, stable).toString()).toBe('1.2.3-alpha')
    expect(Semver.max(alpha, stable).toString()).toBe('1.2.3')
  })

  test('equivalence compares semver values semantically', () => {
    expect(Semver.equivalence(Semver.fromString('1.2.3'), Semver.make(1, 2, 3))).toBe(true)
    expect(Semver.equivalence(Semver.fromString('1.2.3'), Semver.fromString('1.2.4'))).toBe(false)
  })

  test('type guards, constants, and helpers expose the expected semver shape', () => {
    expect(Semver.is(Semver.zero)).toBe(true)
    expect(Semver.zero.toString()).toBe('0.0.0')
    expect(Semver.one.toString()).toBe('1.0.0')
    expect(Semver.maxBump('patch', 'minor')).toBe('minor')
    expect(Semver.maxBump('major', 'patch')).toBe('major')
    expect(Semver.getPrerelease(Semver.fromString('2.0.0-rc.2'))).toEqual(['rc', 2])
    expect(Semver.getPrerelease(Semver.fromString('2.0.0'))).toBeUndefined()
  })

  test('increment bumps each supported segment and strips prereleases', () => {
    const prerelease = Semver.fromString('1.2.3-rc.2')

    expect(Semver.increment(prerelease, 'patch').toString()).toBe('1.2.4')
    expect(Semver.increment(prerelease, 'minor').toString()).toBe('1.3.0')
    expect(Semver.increment(prerelease, 'major').toString()).toBe('2.0.0')
  })

  test('match branches across official and prerelease variants', () => {
    const matchVersion = Semver.match(
      (release) => `release:${release.major}`,
      (preRelease) => `pre:${preRelease.prerelease.join('.')}`,
    )

    expect(matchVersion(Semver.fromString('3.0.0'))).toBe('release:3')
    expect(matchVersion(Semver.fromString('3.0.0-beta.2'))).toBe('pre:beta.2')
  })
})
