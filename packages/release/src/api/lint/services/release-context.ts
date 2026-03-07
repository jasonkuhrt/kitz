import { Context, Layer } from 'effect'
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
}

export class ReleaseContextService extends Context.Tag('ReleaseContextService')<
  ReleaseContextService,
  ReleaseContext
>() {}

export const make = (context: Partial<ReleaseContext>): Layer.Layer<ReleaseContextService> =>
  Layer.succeed(ReleaseContextService, {
    lifecycle: context.lifecycle ?? null,
    publishing: context.publishing ?? defaultPublishing(),
  })

export const DefaultReleaseContextLayer = make({})
