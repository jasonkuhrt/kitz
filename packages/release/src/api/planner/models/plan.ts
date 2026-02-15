import { Schema as S } from 'effect'
import { type Lifecycle, LifecycleSchema } from '../../version/models/lifecycle.js'
import { ItemSchema } from './item.js'

/**
 * Release plan - the unified schema for both domain model and file format.
 *
 * The plan is persisted to `.release/plan.json` and contains all data needed
 * to execute releases. Commit metadata (author, date, full CC structure)
 * is preserved; flattening for changelogs happens lazily at generation time.
 */
export class Plan extends S.TaggedClass<Plan>()('Plan', {
  lifecycle: LifecycleSchema,
  timestamp: S.String,
  releases: S.Array(ItemSchema),
  cascades: S.Array(ItemSchema),
}) {
  static is = S.is(Plan)

  /**
   * Empty plan for resource initialization.
   */
  static empty = Plan.make({
    lifecycle: 'official',
    timestamp: '',
    releases: [],
    cascades: [],
  })
}

/**
 * Create a plan from releases and cascades.
 */
export const make = (
  lifecycle: Lifecycle,
  releases: Plan['releases'],
  cascades: Plan['cascades'],
): Plan =>
  Plan.make({
    lifecycle,
    timestamp: new Date().toISOString(),
    releases: [...releases],
    cascades: [...cascades],
  })
