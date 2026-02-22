import { Schema } from 'effect'
import { RuleId } from './rule-defaults.js'
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
  violation: Schema.optional(Violation),
  /** Optional metadata returned by the rule (e.g., npm username, git remote URL). */
  metadata: Schema.optional(Schema.Unknown),
}) {
  static is = Schema.is(Finished)
}

/** Rule encountered an error during execution. */
export class Failed extends Schema.TaggedClass<Failed>()('RuleCheckResultFailed', {
  rule: RuleRefSchema,
  duration: Schema.Number,
  error: Schema.Unknown,
}) {
  static is = Schema.is(Failed)
}

/** Why a rule was skipped. */
export const SkipReason = Schema.Union(
  Schema.Literal('filtered'),
  Schema.Literal('preconditions-not-met'),
)
export type SkipReason = typeof SkipReason.Type

/** Rule was skipped (filtered or preconditions not met with auto-enable). */
export class Skipped extends Schema.TaggedClass<Skipped>()('RuleCheckResultSkipped', {
  rule: RuleRefSchema,
  reason: SkipReason,
}) {
  static is = Schema.is(Skipped)
}

/** Outcome of checking a single rule. */
export type RuleCheckResult = Finished | Failed | Skipped

export const RuleCheckResult = Schema.Union(Finished, Failed, Skipped)

/** Aggregation of violations from a lint run. */
export class Report extends Schema.TaggedClass<Report>()('Report', {
  results: Schema.Array(RuleCheckResult),
}) {
  static is = Schema.is(Report)
}
