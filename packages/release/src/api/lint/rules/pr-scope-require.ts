import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { getInvalidTitleViolation, getParsedCommit } from './pr-helpers.js'
import { PrService } from '../services/pr.js'

/** Requires the PR title to include at least one scope. */
export const rule = RuntimeRule.create({
  id: RuleId.make('pr.scope.require'),
  description: 'At least one scope required',
  preconditions: [Precondition.HasOpenPR.make()],
  defaults: RuleDefaults.make({ enabled: false }),
  check: Effect.gen(function* () {
    const pr = yield* PrService
    const invalidTitle = getInvalidTitleViolation(pr)
    if (invalidTitle) return invalidTitle
    const commit = getParsedCommit(pr)!
    const scopes = ConventionalCommits.Commit.scopes(commit)
    if (scopes.length === 0) {
      return Violation.make({
        location: PrTitle.make({ title: pr.title }),
      })
    }
    return undefined
  }),
})
