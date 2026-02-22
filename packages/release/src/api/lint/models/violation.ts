import { Schema } from 'effect'
import { ViolationLocation } from './violation-location.js'

/** A single rule failure with location. */
export class Violation extends Schema.TaggedClass<Violation>()('Violation', {
  /** Where the violation occurred. */
  location: ViolationLocation,
}) {
  static is = Schema.is(Violation)
}

/** Heuristic suggestion. Shown to user, never auto-applied. */
export class Hint extends Schema.TaggedClass<Hint>()('Hint', {
  /** Human-readable suggestion. */
  description: Schema.String,
}) {
  static is = Schema.is(Hint)
}
