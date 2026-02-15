import type { Semver } from '@kitz/semver'
import type { Option } from 'effect'
import type { Package } from '../workspace.js'

/**
 * Transitive version bump — a package that needs bumping
 * because one of its dependencies was directly impacted.
 */
export interface CascadeImpact {
  readonly package: Package
  readonly triggeredBy: Package[]
  readonly currentVersion: Option.Option<Semver.Semver>
}
