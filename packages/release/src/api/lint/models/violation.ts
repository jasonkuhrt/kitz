import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { ViolationLocation } from './violation-location.js'

/** Human-readable documentation link for a violation. */
export class DocLink extends Sch.TaggedClass<DocLink>()('ViolationDocLink', {
  label: Schema.String,
  url: Schema.String,
}) {}

/** Ordered step in a user-facing fix guide. */
export class FixStep extends Sch.TaggedClass<FixStep>()('ViolationFixStep', {
  description: Schema.String,
}) {}

/** Manual or guided remediation for a violation. */
export class GuideFix extends Sch.TaggedClass<GuideFix>()('ViolationGuideFix', {
  /** Short operator-facing description of the remediation. */
  summary: Schema.String,
  /** Ordered steps to complete the remediation. */
  steps: Schema.Array(FixStep),
  /** Links specifically relevant to completing the fix. */
  docs: Schema.optional(Schema.Array(DocLink)),
}) {}

/** Single-command remediation for a violation. */
export class CommandFix extends Sch.TaggedClass<CommandFix>()('ViolationCommandFix', {
  /** Short operator-facing description of the remediation. */
  summary: Schema.String,
  /** Command to run verbatim. */
  command: Schema.String,
  /** Links specifically relevant to completing the fix. */
  docs: Schema.optional(Schema.Array(DocLink)),
}) {}

/** First-class remediation attached to a violation. */
export const ViolationFix = Schema.Union([GuideFix, CommandFix]).pipe(Schema.toTaggedUnion('_tag'))
export type ViolationFix = typeof ViolationFix.Type

export namespace ViolationFix {
  export type GuideFix = import('./violation.js').GuideFix
  export type CommandFix = import('./violation.js').CommandFix
}

/** Heuristic suggestion. Shown to user, never auto-applied. */
export class Hint extends Sch.TaggedClass<Hint>()('Hint', {
  /** Human-readable suggestion. */
  description: Schema.String,
}) {}

/** A single rule failure with location. */
export class Violation extends Sch.TaggedClass<Violation>()('Violation', {
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
}) {}
