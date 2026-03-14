import type { Fs } from '@kitz/fs'
import type { Pkg } from '@kitz/pkg'
import type { Semver } from '@kitz/semver'
import { Layer, ServiceMap } from 'effect'

/**
 * Planned release for a package.
 */
export interface PlannedRelease {
  /** Package name. */
  readonly packageName: Pkg.Moniker.Moniker
  /** Package directory on disk. */
  readonly packagePath: Fs.Path.AbsDir
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
export class ReleasePlanService extends ServiceMap.Service<ReleasePlanService, ReleasePlan>()(
  'ReleasePlanService',
) {}

/**
 * Create a layer with release plan data.
 */
export const make = (releases: readonly PlannedRelease[]): Layer.Layer<ReleasePlanService> =>
  Layer.succeed(ReleasePlanService, { releases })

/** Safe default release-plan context for runs with no active release plan. */
export const DefaultReleasePlanLayer = make([])
