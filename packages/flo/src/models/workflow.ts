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
  static decode = Schema.decode(Completed)
  static decodeSync = Schema.decodeSync(Completed)
  static encode = Schema.encode(Completed)
  static encodeSync = Schema.encodeSync(Completed)
  static ordered = false as const
  static make = this.makeUnsafe
}

/**
 * Workflow failed.
 */
export class Failed extends Schema.TaggedClass<Failed>()('WorkflowFailed', {
  timestamp: Schema.Date,
  error: Schema.String,
}) {
  static is = Schema.is(Failed)
  static decode = Schema.decode(Failed)
  static decodeSync = Schema.decodeSync(Failed)
  static encode = Schema.encode(Failed)
  static encodeSync = Schema.encodeSync(Failed)
  static ordered = false as const
  static make = this.makeUnsafe
}

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
