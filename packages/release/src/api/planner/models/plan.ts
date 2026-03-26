import { Schema as S } from 'effect'
import { type Lifecycle, LifecycleSchema } from '../../version/models/lifecycle.js'
import { Candidate } from './item-candidate.js'
import { Ephemeral } from './item-ephemeral.js'
import { ItemSchema, type Item } from './item.js'
import { Official } from './item-official.js'

interface PlanItemsByLifecycle {
  readonly official: Official
  readonly candidate: Candidate
  readonly ephemeral: Ephemeral
}

export type PlannedItem<$lifecycle extends Lifecycle> = PlanItemsByLifecycle[$lifecycle]

export type PlanOf<$lifecycle extends Lifecycle> = Plan & {
  readonly lifecycle: $lifecycle
  readonly releases: PlannedItem<$lifecycle>[]
  readonly cascades: PlannedItem<$lifecycle>[]
}

const matchesLifecycle = <$lifecycle extends Lifecycle>(
  lifecycle: $lifecycle,
  item: Item,
): item is PlannedItem<$lifecycle> => {
  switch (lifecycle) {
    case 'official':
      return Official.is(item)
    case 'candidate':
      return Candidate.is(item)
    case 'ephemeral':
      return Ephemeral.is(item)
  }
}

const mismatchMessage = (
  lifecycle: Lifecycle,
  item: Item,
  collection: 'releases' | 'cascades',
): string => `Plan lifecycle "${lifecycle}" cannot include ${item._tag} items in ${collection}.`

export const hasConsistentLifecycle = (plan: Plan): boolean =>
  plan.releases.every((item) => matchesLifecycle(plan.lifecycle, item)) &&
  plan.cascades.every((item) => matchesLifecycle(plan.lifecycle, item))

export const assertLifecycleConsistency = <T extends Plan>(plan: T): T => {
  const releaseMismatch = plan.releases.find((item) => !matchesLifecycle(plan.lifecycle, item))
  if (releaseMismatch) {
    throw new TypeError(mismatchMessage(plan.lifecycle, releaseMismatch, 'releases'))
  }

  const cascadeMismatch = plan.cascades.find((item) => !matchesLifecycle(plan.lifecycle, item))
  if (cascadeMismatch) {
    throw new TypeError(mismatchMessage(plan.lifecycle, cascadeMismatch, 'cascades'))
  }

  return plan
}

export const isPlanOf = <$lifecycle extends Lifecycle>(
  lifecycle: $lifecycle,
  plan: Plan,
): plan is PlanOf<$lifecycle> => plan.lifecycle === lifecycle && hasConsistentLifecycle(plan)

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
  static decode = S.decodeUnknownEffect(Plan)
  static decodeSync = S.decodeUnknownSync(Plan)
  static encode = S.encodeUnknownEffect(Plan)
  static encodeSync = S.encodeUnknownSync(Plan)
  static equivalence = S.toEquivalence(Plan)
  static ordered = false as const
  static make = (input: {
    readonly lifecycle: Lifecycle
    readonly timestamp: string
    readonly releases: Plan['releases']
    readonly cascades: Plan['cascades']
  }): Plan => assertLifecycleConsistency(this.makeUnsafe(input))
  static is = (value: unknown): value is Plan => S.is(Plan)(value) && hasConsistentLifecycle(value)

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
export const make = <$lifecycle extends Lifecycle>(
  lifecycle: $lifecycle,
  releases: PlannedItem<$lifecycle>[],
  cascades: PlannedItem<$lifecycle>[],
): PlanOf<$lifecycle> =>
  assertLifecycleConsistency(
    Plan.make({
      lifecycle,
      timestamp: new Date().toISOString(),
      releases: [...releases],
      cascades: [...cascades],
    }),
  ) as PlanOf<$lifecycle>
