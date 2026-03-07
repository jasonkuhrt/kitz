import { Schema } from 'effect'
import { ViolationLocation } from './violation-location.js'

/** Human-readable documentation link for a violation. */
export class DocLink extends Schema.TaggedClass<DocLink>()('ViolationDocLink', {
  label: Schema.String,
  url: Schema.String,
}) {
  static is = Schema.is(DocLink)
}

/** Heuristic suggestion. Shown to user, never auto-applied. */
export class Hint extends Schema.TaggedClass<Hint>()('Hint', {
  /** Human-readable suggestion. */
  description: Schema.String,
}) {
  static is = Schema.is(Hint)
}

/** A single rule failure with location. */
export class Violation extends Schema.TaggedClass<Violation>()('Violation', {
  /** Where the violation occurred. */
  location: ViolationLocation,
  /** Short summary tailored to operators. */
  summary: Schema.optional(Schema.String),
  /** Extra context explaining the failure and why it matters. */
  detail: Schema.optional(Schema.String),
  /** Heuristic suggestions. Shown to user, never auto-applied. */
  hints: Schema.optional(Schema.Array(Hint)),
  /** Links to relevant documentation. */
  docs: Schema.optional(Schema.Array(DocLink)),
}) {
  static is = Schema.is(Violation)
}
