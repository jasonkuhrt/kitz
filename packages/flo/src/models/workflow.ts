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
 * Workflow failed.
 */
export class Failed extends Schema.TaggedClass<Failed>()('WorkflowFailed', {
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
