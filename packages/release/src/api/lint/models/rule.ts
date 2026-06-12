import { Sch } from '@kitz/sch'
import { Schema } from 'effect'
import { Precondition } from './precondition.js'
import { RuleDefaults, RuleId } from './rule-defaults.js'

/**
 * A lint rule definition (data only, no check logic).
 *
 * Rules are identified by dot-notation IDs (e.g. `'pr.type.match-known'`).
 * Preconditions determine when the rule is applicable.
 * Defaults can override global config for enabled/severity.
 */
export class Rule extends Sch.TaggedClass<Rule>()('Rule', {
  id: RuleId,
  description: Schema.String,
  preventsDescriptions: Schema.optional(Schema.Array(Schema.String)),
  preconditions: Schema.Array(Precondition),
  defaults: Schema.optional(RuleDefaults),
}) {}
