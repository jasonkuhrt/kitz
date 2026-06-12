import { Sch } from '@kitz/sch'
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
export class Finished extends Sch.TaggedClass<Finished>()('RuleCheckResultFinished', {
  rule: RuleRefSchema,
  duration: Schema.Number,
  severity: Severity,
  violation: Schema.optional(Violation),
  /** Optional metadata returned by the rule (e.g., npm username, git remote URL). */
  metadata: Schema.optional(Schema.Unknown),
}) {}

/** Rule encountered an error during execution. */
export class Failed extends Sch.TaggedClass<Failed>()('RuleCheckResultFailed', {
  rule: RuleRefSchema,
  duration: Schema.Number,
  error: Schema.Unknown,
}) {}

/** Why a rule was skipped. */
export const SkipReason = Schema.Union([
  Schema.Literal('filtered'),
  Schema.Literal('preconditions-not-met'),
])
export type SkipReason = typeof SkipReason.Type

/** Rule was skipped (filtered or preconditions not met with auto-enable). */
export class Skipped extends Sch.TaggedClass<Skipped>()('RuleCheckResultSkipped', {
  rule: RuleRefSchema,
  reason: SkipReason,
}) {}

/** Outcome of checking a single rule. */
export type RuleCheckResult = Finished | Failed | Skipped

export const RuleCheckResult = Schema.Union([Finished, Failed, Skipped])

/** Aggregation of violations from a lint run. */
export class Report extends Sch.TaggedClass<Report>()('Report', {
  results: Schema.Array(RuleCheckResult),
}) {}
