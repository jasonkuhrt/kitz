import type { Pkg } from '@kitz/pkg'
import type { Semver } from '@kitz/semver'
import { Context, Layer } from 'effect'

/**
 * Planned release for a package.
 */
export interface PlannedRelease {
  /** Package name. */
  readonly packageName: Pkg.Moniker.Moniker
  /** Version to be released. */
  readonly version: Semver.Semver
}

/**
 * Release plan data available to lint rules.
 *
 * This is provided when running lint checks in the context of a release.
 * Rules with HasReleasePlan precondition can access this service.
 */
export interface ReleasePlan {
  /** Packages and versions to be released. */
  readonly releases: readonly PlannedRelease[]
}

/** Service providing release plan data. */
export class ReleasePlanService extends Context.Tag('ReleasePlanService')<ReleasePlanService, ReleasePlan>() {}

/**
 * Create a layer with release plan data.
 */
export const make = (releases: readonly PlannedRelease[]): Layer.Layer<ReleasePlanService> =>
  Layer.succeed(ReleasePlanService, { releases })
