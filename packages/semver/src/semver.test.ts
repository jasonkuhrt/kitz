import { Test } from '@kitz/test'
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
  .on((version: Semver.OfficialRelease.OfficialRelease, prerelease: Semver.PreRelease.PreRelease['prerelease']) =>
    Semver.officialToPre(version, { prerelease }).toString()
  )
  .cases(
    [[Semver.OfficialRelease.OfficialRelease.make({ major: 1, minor: 2, patch: 3 }), pre('next', 1)], '1.2.3-next.1'],
    [[
      Semver.OfficialRelease.OfficialRelease.make({ major: 1, minor: 2, patch: 3, build: ['build', '7'] }),
      pre('next', 2),
    ], '1.2.3-next.2+build.7'],
    [[Semver.stripPre(Semver.fromString('1.2.3-beta.1+build.7')), pre('rc', 1)], '1.2.3-rc.1+build.7'],
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
  .on((
    version: Semver.Semver,
    prerelease: Semver.PreRelease.PreRelease['prerelease'],
    build?: Semver.PreRelease.PreRelease['build'],
  ) => Semver.withPre(version, prerelease, build).toString())
  .cases(
    [[Semver.fromString('1.2.3'), pre('next', 1)], '1.2.3-next.1'],
    [[Semver.fromString('1.2.3-beta.1+build.7'), pre('rc', 1)], '1.2.3-rc.1+build.7'],
    [[Semver.fromString('1.2.3+build.7'), pre('rc', 2), ['meta', '2']], '1.2.3-rc.2+meta.2'],
  )
  .test()
