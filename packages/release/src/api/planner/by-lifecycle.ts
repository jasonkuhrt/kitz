import type { Lifecycle } from '../version/models/lifecycle.js'
import { candidate } from './candidate.js'
import { ephemeral } from './ephemeral.js'
import { official } from './official.js'

/**
 * Planner dispatch table keyed by release lifecycle.
 *
 * Each entry is that lifecycle's planner entrypoint with its exact signature:
 * `official` and `candidate` take `Options` and need only FileSystem;
 * `ephemeral` takes `EphemeralOptions` and additionally needs Git and
 * Env (to resolve the PR number and HEAD SHA).
 *
 * @example
 * ```ts
 * const plan = yield* Planner.byLifecycle[lifecycle](analysis, ctx, options)
 * ```
 */
export const byLifecycle = {
  official,
  candidate,
  ephemeral,
} as const satisfies Record<Lifecycle, unknown>
