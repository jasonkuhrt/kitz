import { FileSystem } from 'effect'
import { Resource } from '@kitz/resource'
import { Effect } from 'effect'
import { buildDependencyGraph, type DependencyGraph } from '../analyzer/cascade.js'
import type { Analysis, Impact } from '../analyzer/models/__.js'
import type { Package } from '../analyzer/workspace.js'
import type { Lifecycle } from '../version/models/lifecycle.js'
import { detect as detectOfficialCascades } from './cascade.js'
import type { Official } from './models/item-official.js'
import { make, type PlanOf, type PlannedItem } from './models/plan.js'
import { passesFilter } from './options.js'

interface FilterOptionsLike {
  readonly packages?: readonly string[]
  readonly exclude?: readonly string[]
}

type PrereleaseLifecycle = Exclude<Lifecycle, 'official'>

interface CascadeParams<$lifecycle extends Lifecycle> {
  readonly packages: Package[]
  readonly primaryReleases: readonly PlannedItem<$lifecycle>[]
  readonly dependencyGraph: DependencyGraph
  readonly tags: readonly string[]
}

export interface PlanLifecycleParams<
  $lifecycle extends Lifecycle,
  $options extends FilterOptionsLike | undefined = FilterOptionsLike | undefined,
> {
  readonly analysis: Analysis
  readonly packages: readonly Package[]
  readonly lifecycle: $lifecycle
  readonly options?: $options
  readonly toPrimaryRelease: (impact: Impact) => PlannedItem<$lifecycle>
  readonly toCascades: (params: CascadeParams<$lifecycle>) => readonly PlannedItem<$lifecycle>[]
}

export const mapOfficialCascades = <
  $release extends PlannedItem<Lifecycle>,
  $cascade extends PlannedItem<PrereleaseLifecycle>,
>(params: {
  readonly packages: Package[]
  readonly primaryReleases: readonly $release[]
  readonly dependencyGraph: DependencyGraph
  readonly tags: readonly string[]
  readonly map: (cascade: Official) => $cascade
}): readonly $cascade[] =>
  detectOfficialCascades(
    [...params.packages],
    [...params.primaryReleases],
    params.dependencyGraph,
    [...params.tags],
  ).map(params.map)

export const planLifecycle = <
  $lifecycle extends Lifecycle,
  $options extends FilterOptionsLike | undefined = FilterOptionsLike | undefined,
>(
  params: PlanLifecycleParams<$lifecycle, $options>,
): Effect.Effect<PlanOf<$lifecycle>, Resource.ResourceError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const releases: PlannedItem<$lifecycle>[] = []

    for (const impact of params.analysis.impacts) {
      if (!passesFilter(impact.package.name.moniker, params.options)) continue
      releases.push(params.toPrimaryRelease(impact))
    }

    const dependencyGraph = yield* buildDependencyGraph([...params.packages])
    const cascades = params.toCascades({
      packages: [...params.packages],
      primaryReleases: releases,
      dependencyGraph,
      tags: [...params.analysis.tags],
    })

    return make(params.lifecycle, releases, [...cascades])
  })
