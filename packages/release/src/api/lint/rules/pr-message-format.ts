import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'

export const rule = RuntimeRule.create({
  id: RuleId.make('pr.message.format'),
  description: 'Custom regex message enforcement',
  preconditions: [Precondition.HasOpenPR.make()],
  // TODO: Implement custom regex check against PR title/body from config.
  check: Effect.succeed(undefined),
})
