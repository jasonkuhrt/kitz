import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'

/**
 * First release of a package - no previous version exists.
 */
export class StableVersionFirst extends S.Class<StableVersionFirst>('First')({
  version: Semver.Semver,
}) {
  static is = S.is(StableVersionFirst)
}

/**
 * Increment from an existing version.
 */
export class StableVersionIncrement extends S.Class<StableVersionIncrement>('Increment')({
  from: Semver.Semver,
  to: Semver.Semver,
  bump: S.Literal('major', 'minor', 'patch'),
}) {
  static is = S.is(StableVersionIncrement)
}

/**
 * A stable version is either the first release or an increment.
 */
export type StableVersion = StableVersionFirst | StableVersionIncrement
