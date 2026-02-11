import { Schema as S } from 'effect'
import { BuildIds, PrereleaseIds } from './identifiers.js'

const formatPreRelease = (version: PreRelease): string => {
  const prereleaseStr = `-${version.prerelease.join('.')}`
  const buildStr = version.build?.length ? `+${version.build.join('.')}` : ''
  return `${version.major}.${version.minor}.${version.patch}${prereleaseStr}${buildStr}`
}

/**
 * A semantic version with pre-release identifiers.
 */
export class PreRelease extends S.TaggedClass<PreRelease>()('SemverPreRelease', {
  major: S.Number.pipe(S.int(), S.nonNegative()),
  minor: S.Number.pipe(S.int(), S.nonNegative()),
  patch: S.Number.pipe(S.int(), S.nonNegative()),
  prerelease: PrereleaseIds,
  build: S.optional(BuildIds),
}, {
  identifier: 'PreRelease',
  title: 'Pre-Release',
  description: 'A semantic version with pre-release identifiers',
}) {
  static is = S.is(PreRelease)
  static override toString = (version: PreRelease): string => formatPreRelease(version)

  /** String representation for JS coercion (template literals, logging) */
  override toString(): string {
    return PreRelease.toString(this)
  }
}
