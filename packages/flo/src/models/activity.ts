/**
 * @module activity
 *
 * Activity data types for workflow execution tracking.
 *
 * Provides event types for activity lifecycle tracking and state for rendering.
 */

import { Schema } from 'effect'

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * Activity execution state.
 *
 * - `pending`: Not yet started
 * - `running`: Currently executing
 * - `completed`: Finished successfully
 * - `failed`: Finished with error
 */
export const State = Schema.Enum({
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
} as const)

export type State = typeof State.Type

// ─── Events ──────────────────────────────────────────────────────────────────

/**
 * Activity started executing.
 */
export class Started extends Schema.TaggedClass<Started>()('ActivityStarted', {
  activity: Schema.String,
  timestamp: Schema.Date,
  /** True if this activity was already completed (resumed from checkpoint) */
  resumed: Schema.Boolean,
}) {
  static equivalence = Schema.toEquivalence(Started)
  static is = Schema.is(Started)
  static get decode(): any {
    return Schema.decode(Started)
  }
  static get decodeSync(): any {
    return Schema.decodeSync(Started)
  }
  static get encode(): any {
    return Schema.encode(Started)
  }
  static get encodeSync(): any {
    return Schema.encodeSync(Started)
  }
  static ordered = false as const
  static make = this.makeUnsafe
}

/**
 * Activity completed successfully.
 */
export class Completed extends Schema.TaggedClass<Completed>()('ActivityCompleted', {
  activity: Schema.String,
  timestamp: Schema.Date,
  /** True if this activity was already completed (resumed from checkpoint) */
  resumed: Schema.Boolean,
  /** Duration in milliseconds (very short if resumed) */
  durationMs: Schema.Number,
}) {
  static equivalence = Schema.toEquivalence(Completed)
  static is = Schema.is(Completed)
  static get decode(): any {
    return Schema.decode(Completed)
  }
  static get decodeSync(): any {
    return Schema.decodeSync(Completed)
  }
  static get encode(): any {
    return Schema.encode(Completed)
  }
  static get encodeSync(): any {
    return Schema.encodeSync(Completed)
  }
  static ordered = false as const
  static make = this.makeUnsafe
}

/**
 * Activity failed.
 */
export class Failed extends Schema.TaggedClass<Failed>()('ActivityFailed', {
  activity: Schema.String,
  timestamp: Schema.Date,
  error: Schema.String,
}) {
  static equivalence = Schema.toEquivalence(Failed)
  static is = Schema.is(Failed)
  static get decode(): any {
    return Schema.decode(Failed)
  }
  static get decodeSync(): any {
    return Schema.decodeSync(Failed)
  }
  static get encode(): any {
    return Schema.encode(Failed)
  }
  static get encodeSync(): any {
    return Schema.encodeSync(Failed)
  }
  static ordered = false as const
  static make = this.makeUnsafe
}

/**
 * Activity lifecycle event.
 */
export type Event = Started | Completed | Failed

/**
 * Schema for activity lifecycle events.
 */
export const Event = Schema.Union([Started, Completed, Failed]).pipe(Schema.toTaggedUnion('_tag'))

export namespace Event {
  export type Started = import('./activity.js').Started
  export type Completed = import('./activity.js').Completed
  export type Failed = import('./activity.js').Failed
}

/**
 * Derive activity state from an event.
 */
export const stateFromEvent = (event: Event): State =>
  Event.match(event, {
    ActivityStarted: () => State.enums.running,
    ActivityCompleted: () => State.enums.completed,
    ActivityFailed: () => State.enums.failed,
  })
