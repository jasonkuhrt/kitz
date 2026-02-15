import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'
import { PackageSchema } from './package-schema.js'

/**
 * Transitive version bump — a package that needs bumping
 * because one of its dependencies was directly impacted.
 */
export class CascadeImpact extends S.TaggedClass<CascadeImpact>()('CascadeImpact', {
  package: PackageSchema,
  triggeredBy: S.Array(PackageSchema),
  currentVersion: S.OptionFromNullOr(Semver.Schema),
}) {
  static is = S.is(CascadeImpact)
}
