import { Sch } from '@kitz/sch'
import { Schema as S } from 'effect'
import { BuildIds } from './identifiers.js'

const formatOfficialRelease = (version: OfficialRelease): string => {
  const buildStr = version.build?.length ? `+${version.build.join('.')}` : ''
  return `${version.major}.${version.minor}.${version.patch}${buildStr}`
}

/**
 * A semantic version that is an official release (no pre-release identifiers).
 */
export class OfficialRelease extends Sch.TaggedClass<OfficialRelease>()(
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
  static override toString = (version: OfficialRelease): string => formatOfficialRelease(version)

  /** String representation for JS coercion (template literals, logging) */
  override toString(): string {
    return OfficialRelease.toString(this)
  }
}
