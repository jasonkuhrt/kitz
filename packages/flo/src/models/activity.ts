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

/**
 * Derive activity state from an event.
 */
export const stateFromEvent = (event: Event): State =>
  Event.match(event, {
    ActivityStarted: () => State.enums.running,
    ActivityCompleted: () => State.enums.completed,
    ActivityFailed: () => State.enums.failed,
  })
