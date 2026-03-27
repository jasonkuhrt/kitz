import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import { ReleaseCommit } from './commit.js'
import { PackageSchema } from './package-schema.js'

const CurrentVersionSchema: S.Codec<
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
  static make = this.makeUnsafe
  static is = S.is(Impact)
  static decode = S.decodeUnknownEffect(Impact)
  static decodeSync = S.decodeUnknownSync(Impact)
  static encode = S.encodeUnknownEffect(Impact)
  static encodeSync = S.encodeUnknownSync(Impact)
  static equivalence = S.toEquivalence(Impact)
  static ordered = false as const
}
