import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'
import { ReleaseCommit } from './commit.js'
import { PackageSchema } from './package-schema.js'

/**
 * Per-package change analysis — what changed and how much.
 */
export class Impact extends S.TaggedClass<Impact>()('Impact', {
  package: PackageSchema,
  bump: Semver.BumpType,
  commits: S.Array(ReleaseCommit),
  currentVersion: S.OptionFromNullOr(Semver.Schema),
}) {
  static is = S.is(Impact)
}
