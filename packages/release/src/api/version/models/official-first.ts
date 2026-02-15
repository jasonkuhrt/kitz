import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'

/**
 * First release of a package - no previous version exists.
 */
export class OfficialFirst extends S.TaggedClass<OfficialFirst>()('OfficialFirst', {
  version: Semver.Semver,
}) {
  static is = S.is(OfficialFirst)
}
