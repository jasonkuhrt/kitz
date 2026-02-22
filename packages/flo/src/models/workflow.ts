/**
 * @module workflow
 *
 * Workflow-level events.
 */

import { Schema } from 'effect'

/**
 * Workflow completed successfully.
 */
export class Completed extends Schema.TaggedClass<Completed>()('WorkflowCompleted', {
  timestamp: Schema.Date,
  durationMs: Schema.Number,
}) {
  static is = Schema.is(Completed)
}

/**
 * Workflow failed.
 */
export class Failed extends Schema.TaggedClass<Failed>()('WorkflowFailed', {
  timestamp: Schema.Date,
  error: Schema.String,
}) {
  static is = Schema.is(Failed)
}

/**
 * Workflow lifecycle event.
 */
export type Event = Completed | Failed

/**
 * Schema for workflow lifecycle events.
 */
export const Event = Schema.Union(Completed, Failed)
