import { Schema as S } from 'effect'
import { BuildIds } from './identifiers.js'

const formatOfficialRelease = (version: OfficialRelease): string => {
  const buildStr = version.build?.length ? `+${version.build.join('.')}` : ''
  return `${version.major}.${version.minor}.${version.patch}${buildStr}`
}

/**
 * A semantic version that is an official release (no pre-release identifiers).
 */
export class OfficialRelease extends S.TaggedClass<OfficialRelease>()(
  'SemverOfficialRelease',
  {
    major: S.Number.pipe(S.check(S.isInt(), S.isGreaterThanOrEqualTo(0))),
    minor: S.Number.pipe(S.check(S.isInt(), S.isGreaterThanOrEqualTo(0))),
    patch: S.Number.pipe(S.check(S.isInt(), S.isGreaterThanOrEqualTo(0))),
    build: S.optional(BuildIds),
  },
  {
    identifier: 'OfficialRelease',
    title: 'Official Release',
    description: 'A semantic version that is an official release (no pre-release identifiers)',
  },
) {
  static make = this.makeUnsafe
  static is = S.is(OfficialRelease)
  static decode = S.decodeUnknownEffect(OfficialRelease)
  static decodeSync = S.decodeUnknownSync(OfficialRelease)
  static encode = S.encodeUnknownEffect(OfficialRelease)
  static encodeSync = S.encodeUnknownSync(OfficialRelease)
  static equivalence = S.toEquivalence(OfficialRelease)
  static ordered = false as const
  static override toString = (version: OfficialRelease): string => formatOfficialRelease(version)

  /** String representation for JS coercion (template literals, logging) */
  override toString(): string {
    return OfficialRelease.toString(this)
  }
}
