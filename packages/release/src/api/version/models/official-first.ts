import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'

const SemverSchema: S.Schema<Semver.Semver, Semver.Semver> = Semver.Semver

/**
 * First release of a package - no previous version exists.
 */
export class OfficialFirst extends S.TaggedClass<OfficialFirst>()('OfficialFirst', {
  version: SemverSchema,
}) {
  static is = S.is(OfficialFirst)
}
