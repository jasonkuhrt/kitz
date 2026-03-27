import { Schema } from 'effect'
import { ViolationLocation } from './violation-location.js'

/** Human-readable documentation link for a violation. */
export class DocLink extends Schema.TaggedClass<DocLink>()('ViolationDocLink', {
  label: Schema.String,
  url: Schema.String,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(DocLink)
  static decode = Schema.decodeUnknownEffect(DocLink)
  static decodeSync = Schema.decodeUnknownSync(DocLink)
  static encode = Schema.encodeUnknownEffect(DocLink)
  static encodeSync = Schema.encodeUnknownSync(DocLink)
  static equivalence = Schema.toEquivalence(DocLink)
  static ordered = false as const
}

/** Ordered step in a user-facing fix guide. */
export class FixStep extends Schema.TaggedClass<FixStep>()('ViolationFixStep', {
  description: Schema.String,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(FixStep)
  static decode = Schema.decodeUnknownEffect(FixStep)
  static decodeSync = Schema.decodeUnknownSync(FixStep)
  static encode = Schema.encodeUnknownEffect(FixStep)
  static encodeSync = Schema.encodeUnknownSync(FixStep)
  static equivalence = Schema.toEquivalence(FixStep)
  static ordered = false as const
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
  static make = this.makeUnsafe
  static is = Schema.is(GuideFix)
  static decode = Schema.decodeUnknownEffect(GuideFix)
  static decodeSync = Schema.decodeUnknownSync(GuideFix)
  static encode = Schema.encodeUnknownEffect(GuideFix)
  static encodeSync = Schema.encodeUnknownSync(GuideFix)
  static equivalence = Schema.toEquivalence(GuideFix)
  static ordered = false as const
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
  static make = this.makeUnsafe
  static is = Schema.is(CommandFix)
  static decode = Schema.decodeUnknownEffect(CommandFix)
  static decodeSync = Schema.decodeUnknownSync(CommandFix)
  static encode = Schema.encodeUnknownEffect(CommandFix)
  static encodeSync = Schema.encodeUnknownSync(CommandFix)
  static equivalence = Schema.toEquivalence(CommandFix)
  static ordered = false as const
}

/** First-class remediation attached to a violation. */
export const ViolationFix = Schema.Union([GuideFix, CommandFix]).pipe(Schema.toTaggedUnion('_tag'))
export type ViolationFix = typeof ViolationFix.Type

export namespace ViolationFix {
  export type GuideFix = import('./violation.js').GuideFix
  export type CommandFix = import('./violation.js').CommandFix
}

/** Heuristic suggestion. Shown to user, never auto-applied. */
export class Hint extends Schema.TaggedClass<Hint>()('Hint', {
  /** Human-readable suggestion. */
  description: Schema.String,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Hint)
  static decode = Schema.decodeUnknownEffect(Hint)
  static decodeSync = Schema.decodeUnknownSync(Hint)
  static encode = Schema.encodeUnknownEffect(Hint)
  static encodeSync = Schema.encodeUnknownSync(Hint)
  static equivalence = Schema.toEquivalence(Hint)
  static ordered = false as const
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
  static make = this.makeUnsafe
  static is = Schema.is(Violation)
  static decode = Schema.decodeUnknownEffect(Violation)
  static decodeSync = Schema.decodeUnknownSync(Violation)
  static encode = Schema.encodeUnknownEffect(Violation)
  static encodeSync = Schema.encodeUnknownSync(Violation)
  static equivalence = Schema.toEquivalence(Violation)
  static ordered = false as const
}
