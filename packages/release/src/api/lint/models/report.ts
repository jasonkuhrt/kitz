import { Schema } from 'effect'
import { RuleId } from './rule-defaults.js'
import { Severity } from './severity.js'
import { Violation } from './violation.js'

/** Minimal rule reference for results. */
export interface RuleRef {
  readonly id: RuleId
  readonly description: string
}

const RuleRefSchema = Schema.Struct({
  id: RuleId,
  description: Schema.String,
})

/** Rule ran and produced a result (violation or clean). */
export class Finished extends Schema.TaggedClass<Finished>()('RuleCheckResultFinished', {
  rule: RuleRefSchema,
  duration: Schema.Number,
  severity: Severity,
  violation: Schema.optional(Violation),
  /** Optional metadata returned by the rule (e.g., npm username, git remote URL). */
  metadata: Schema.optional(Schema.Unknown),
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Finished)
  static decode = Schema.decodeUnknownEffect(Finished)
  static decodeSync = Schema.decodeUnknownSync(Finished)
  static encode = Schema.encodeUnknownEffect(Finished)
  static encodeSync = Schema.encodeUnknownSync(Finished)
  static equivalence = Schema.toEquivalence(Finished)
  static ordered = false as const
}

/** Rule encountered an error during execution. */
export class Failed extends Schema.TaggedClass<Failed>()('RuleCheckResultFailed', {
  rule: RuleRefSchema,
  duration: Schema.Number,
  error: Schema.Unknown,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Failed)
  static decode = Schema.decodeUnknownEffect(Failed)
  static decodeSync = Schema.decodeUnknownSync(Failed)
  static encode = Schema.encodeUnknownEffect(Failed)
  static encodeSync = Schema.encodeUnknownSync(Failed)
  static equivalence = Schema.toEquivalence(Failed)
  static ordered = false as const
}

/** Why a rule was skipped. */
export const SkipReason = Schema.Union([
  Schema.Literal('filtered'),
  Schema.Literal('preconditions-not-met'),
])
export type SkipReason = typeof SkipReason.Type

/** Rule was skipped (filtered or preconditions not met with auto-enable). */
export class Skipped extends Schema.TaggedClass<Skipped>()('RuleCheckResultSkipped', {
  rule: RuleRefSchema,
  reason: SkipReason,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Skipped)
  static decode = Schema.decodeUnknownEffect(Skipped)
  static decodeSync = Schema.decodeUnknownSync(Skipped)
  static encode = Schema.encodeUnknownEffect(Skipped)
  static encodeSync = Schema.encodeUnknownSync(Skipped)
  static equivalence = Schema.toEquivalence(Skipped)
  static ordered = false as const
}

/** Outcome of checking a single rule. */
export type RuleCheckResult = Finished | Failed | Skipped

export const RuleCheckResult = Schema.Union([Finished, Failed, Skipped])

/** Aggregation of violations from a lint run. */
export class Report extends Schema.TaggedClass<Report>()('Report', {
  results: Schema.Array(RuleCheckResult),
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Report)
  static decode = Schema.decodeUnknownEffect(Report)
  static decodeSync = Schema.decodeUnknownSync(Report)
  static encode = Schema.encodeUnknownEffect(Report)
  static encodeSync = Schema.encodeUnknownSync(Report)
  static equivalence = Schema.toEquivalence(Report)
  static ordered = false as const
}
