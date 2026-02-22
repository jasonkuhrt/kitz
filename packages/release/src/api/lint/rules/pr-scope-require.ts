import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { PrService } from '../services/pr.js'

/** Get scopes from a commit (Single or Multi). */
const getScopes = (commit: ConventionalCommits.Commit.Commit): readonly string[] => {
  if (ConventionalCommits.Commit.Single.is(commit)) {
    return commit.scopes
  }
  return commit.targets.map((t) => t.scope)
}

export const rule = RuntimeRule.create({
  id: RuleId.make('pr.scope.require'),
  description: 'At least one scope required',
  preconditions: [Precondition.HasOpenPR.make()],
  defaults: RuleDefaults.make({ enabled: false }),
  check: Effect.gen(function*() {
    const pr = yield* PrService
    const scopes = getScopes(pr.commit)
    if (scopes.length === 0) {
      return Violation.make({
        location: PrTitle.make({ title: pr.title }),
      })
    }
    return undefined
  }),
})
