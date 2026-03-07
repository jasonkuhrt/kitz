import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { getInvalidTitleViolation, getParsedCommit } from './pr-helpers.js'
import { PrService } from '../services/pr.js'

/** Verifies that every PR title type is a standard conventional-commit type. */
export const rule = RuntimeRule.create({
  id: RuleId.make('pr.type.match-known'),
  description: 'Type(s) use standard conventional-commit kinds',
  preconditions: [Precondition.HasOpenPR.make()],
  check: Effect.gen(function* () {
    const pr = yield* PrService
    const invalidTitle = getInvalidTitleViolation(pr)
    if (invalidTitle) return invalidTitle
    const commit = getParsedCommit(pr)!

    const hasUnknownType = ConventionalCommits.Commit.types(commit).some(
      (type) => !ConventionalCommits.Type.Standard.is(type),
    )

    if (hasUnknownType) {
      return Violation.make({
        location: PrTitle.make({ title: pr.title }),
      })
    }
    return undefined
  }),
})
