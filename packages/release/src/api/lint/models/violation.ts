import { Schema } from 'effect'
import { ViolationLocation } from './violation-location.js'

/** Human-readable documentation link for a violation. */
export class DocLink extends Schema.TaggedClass<DocLink>()('ViolationDocLink', {
  label: Schema.String,
  url: Schema.String,
}) {
  static is = Schema.is(DocLink)
}

/** Ordered step in a user-facing fix guide. */
export class FixStep extends Schema.TaggedClass<FixStep>()('ViolationFixStep', {
  description: Schema.String,
}) {
  static is = Schema.is(FixStep)
}

/** Manual or guided remediation for a violation. */
export class GuideFix extends Schema.TaggedClass<GuideFix>()('ViolationGuideFix', {
  /** Short operator-facing description of the remediation. */
  summary: Schema.String,
  /** Ordered steps to complete the remediation. */
  steps: Schema.Array(FixStep),
  /** Links specifically relevant to completing the fix. */
  docs: Schema.optional(Schema.Array(DocLink)),
}) {
  static is = Schema.is(GuideFix)
}

/** Single-command remediation for a violation. */
export class CommandFix extends Schema.TaggedClass<CommandFix>()('ViolationCommandFix', {
  /** Short operator-facing description of the remediation. */
  summary: Schema.String,
  /** Command to run verbatim. */
  command: Schema.String,
  /** Links specifically relevant to completing the fix. */
  docs: Schema.optional(Schema.Array(DocLink)),
}) {
  static is = Schema.is(CommandFix)
}

/** First-class remediation attached to a violation. */
export const ViolationFix = Schema.Union(GuideFix, CommandFix)
export type ViolationFix = typeof ViolationFix.Type

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
  /** First-class remediation for this failure, if one exists. */
  fix: Schema.optional(ViolationFix),
  /** Heuristic suggestions. Shown to user, never auto-applied. */
  hints: Schema.optional(Schema.Array(Hint)),
  /** Links to relevant documentation. */
  docs: Schema.optional(Schema.Array(DocLink)),
}) {
  static is = Schema.is(Violation)
}
