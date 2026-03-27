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
  static is = S.is(OfficialFirst)
  static decode = S.decodeUnknownEffect(OfficialFirst)
  static decodeSync = S.decodeUnknownSync(OfficialFirst)
  static encode = S.encodeUnknownEffect(OfficialFirst)
  static encodeSync = S.encodeUnknownSync(OfficialFirst)
  static equivalence = S.toEquivalence(OfficialFirst)
  static ordered = false as const
}
