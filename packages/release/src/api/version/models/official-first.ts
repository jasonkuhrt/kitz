import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'

const SemverSchema = Semver.Semver

/**
 * First release of a package - no previous version exists.
 */
export class OfficialFirst extends S.TaggedClass<OfficialFirst>()('OfficialFirst', {
  version: SemverSchema,
}) {
  static make = this.makeUnsafe
  static is = S.is(OfficialFirst as any) as (u: unknown) => u is OfficialFirst
}
