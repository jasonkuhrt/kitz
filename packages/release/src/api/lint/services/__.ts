import { Layer } from 'effect'

export * from './diff.js'
export * from './github.js'
export * from './monorepo.js'
export * from './pr.js'
export * as Preconditions from './preconditions.js'
export * as ReleasePlan from './release-plan.js'
export * from './rule-options.js'

import { DefaultDiffLayer } from './diff.js'
import { DefaultGitHubLayer } from './github.js'
import { DefaultMonorepoLayer } from './monorepo.js'
import { DefaultPrLayer } from './pr.js'

/** Default inert service set for rules gated by unmet preconditions. */
export const DefaultServicesLayer = Layer.mergeAll(
  DefaultDiffLayer,
  DefaultGitHubLayer,
  DefaultMonorepoLayer,
  DefaultPrLayer,
)
