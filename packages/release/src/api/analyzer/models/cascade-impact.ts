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
  static is = S.is(CascadeImpact as any) as (u: unknown) => u is CascadeImpact
}
