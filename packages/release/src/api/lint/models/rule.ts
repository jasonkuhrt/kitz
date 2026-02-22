import { Schema } from 'effect'
import * as Precondition from './precondition.js'
import { RuleDefaults, RuleId } from './rule-defaults.js'

/** A lint rule with preconditions and optional defaults. */
export class Rule extends Schema.TaggedClass<Rule>()('Rule', {
  id: RuleId,
  description: Schema.String,
  preconditions: Schema.Array(Precondition.Precondition),
  defaults: Schema.optional(RuleDefaults),
}) {
  static is = Schema.is(Rule)
}
