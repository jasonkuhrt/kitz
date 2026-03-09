import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import { ReleaseCommit } from './commit.js'
import { PackageSchema } from './package-schema.js'

const CurrentVersionSchema: S.Schema<
  Option.Option<Semver.Semver>,
  string | null
> = S.OptionFromNullOr(Semver.Schema)

/**
 * Per-package change analysis — what changed and how much.
 */
export class Impact extends S.TaggedClass<Impact>()('Impact', {
  package: PackageSchema,
  bump: Semver.BumpType,
  commits: S.Array(ReleaseCommit),
  currentVersion: CurrentVersionSchema,
}) {
  static is = S.is(Impact)
}
