import { Layer, ServiceMap } from 'effect'
import { defaultPublishing, type Publishing } from '../../publishing.js'
import type { Lifecycle } from '../../version/models/lifecycle.js'

/**
 * Release-system context available to lint rules.
 *
 * Carries the declared publish channels plus the active lifecycle when lint
 * is being evaluated against a concrete release plan.
 */
export interface ReleaseContext {
  readonly lifecycle: Lifecycle | null
  readonly publishing: Publishing
  readonly trunk: string | null
  readonly currentBranch: string | null
}

export class ReleaseContextService extends ServiceMap.Service<
  ReleaseContextService,
  ReleaseContext
>()('ReleaseContextService') {}

export const make = (context: Partial<ReleaseContext>): Layer.Layer<ReleaseContextService> =>
  Layer.succeed(ReleaseContextService, {
    lifecycle: context.lifecycle ?? null,
    publishing: context.publishing ?? defaultPublishing(),
    trunk: context.trunk ?? null,
    currentBranch: context.currentBranch ?? null,
  })

export const DefaultReleaseContextLayer = make({})
