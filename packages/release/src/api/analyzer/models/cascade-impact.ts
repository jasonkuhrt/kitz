import { Semver } from '@kitz/semver'
import { Option, Schema as S } from 'effect'
import { PackageSchema } from './package-schema.js'

const CurrentVersionSchema: S.Codec<
  Option.Option<Semver.Semver>,
  string | null
> = S.OptionFromNullOr(Semver.Schema)

/**
 * Transitive version bump — a package that needs bumping
 * because one of its dependencies was directly impacted.
 */
export class CascadeImpact extends S.TaggedClass<CascadeImpact>()('CascadeImpact', {
  package: PackageSchema,
  triggeredBy: S.Array(PackageSchema),
  currentVersion: CurrentVersionSchema,
}) {
  static make = this.makeUnsafe
  static is = S.is(CascadeImpact)
  static decode = S.decodeUnknownEffect(CascadeImpact)
  static decodeSync = S.decodeUnknownSync(CascadeImpact)
  static encode = S.encodeUnknownEffect(CascadeImpact)
  static encodeSync = S.encodeUnknownSync(CascadeImpact)
  static equivalence = S.toEquivalence(CascadeImpact)
  static ordered = false as const
}
