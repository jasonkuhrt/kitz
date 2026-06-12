import { Sch } from '@kitz/sch'
import { Semver } from '@kitz/semver'
import { Schema as S } from 'effect'
import { PackageSchema } from './package-schema.js'

const CurrentVersionSchema = Semver.OptionFromNullOrString

/**
 * Transitive version bump — a package that needs bumping
 * because one of its dependencies was directly impacted.
 */
export class CascadeImpact extends Sch.TaggedClass<CascadeImpact>()('CascadeImpact', {
  package: PackageSchema,
  triggeredBy: S.Array(PackageSchema),
  currentVersion: CurrentVersionSchema,
}) {}
