import { Schema } from 'effect'
import { Severity } from './severity.js'

/** Dot-notation identifier (e.g. 'pr.type.match-known'). */
export const RuleId = Schema.String.pipe(
  Schema.pattern(/^[a-z]+(\.[a-z]+(-[a-z]+)*)+$/),
  Schema.brand('RuleId'),
)
export type RuleId = typeof RuleId.Type

/**
 * Default values for user-configurable rule properties.
 */
export class RuleDefaults extends Schema.TaggedClass<RuleDefaults>()('RuleDefaults', {
  /**
   * false: disabled.
   * true: enabled, errors if any precondition fails.
   * 'auto': enabled if all preconditions pass, silently skipped otherwise.
   * @default 'auto'
   */
  enabled: Schema.optional(Schema.Union(Schema.Boolean, Schema.Literal('auto'))),
  /**
   * Severity level when rule produces violations.
   * @default Severity.Error
   */
  severity: Schema.optional(Severity),
}) {
  static is = Schema.is(RuleDefaults)
}
