import { Sch } from '@kitz/sch'
/**
 * @module workflow
 *
 * Workflow-level events.
 */

import { Schema } from 'effect'

/**
 * Workflow completed successfully.
 */
export class Completed extends Sch.TaggedClass<Completed>()('WorkflowCompleted', {
  timestamp: Schema.Date,
  durationMs: Schema.Number,
}) {}

/**
 * Workflow failed.
 */
export class Failed extends Sch.TaggedClass<Failed>()('WorkflowFailed', {
  timestamp: Schema.Date,
  error: Schema.String,
}) {}

/**
 * Workflow lifecycle event.
 */
export type Event = Completed | Failed

/**
 * Schema for workflow lifecycle events.
 */
export const Event = Schema.Union([Completed, Failed]).pipe(Schema.toTaggedUnion('_tag'))

export namespace Event {
  export type Completed = import('./workflow.js').Completed
  export type Failed = import('./workflow.js').Failed
}
