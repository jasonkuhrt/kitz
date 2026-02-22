import { Git } from '@kitz/git'
import { Effect } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { Environment } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'

export const rule = RuntimeRule.create({
  id: RuleId.make('env.git-clean'),
  description: 'git working directory has no uncommitted changes',
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [],
  check: Effect.gen(function*() {
    const git = yield* Git.Git
    const isClean = yield* git.isClean()

    if (!isClean) {
      return Violation.make({
        location: Environment.make({
          message: 'Working directory has uncommitted changes',
        }),
      })
    }
    return undefined
  }),
})
