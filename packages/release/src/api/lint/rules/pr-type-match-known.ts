import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { PrService } from '../services/pr.js'

export const rule = RuntimeRule.create({
  id: RuleId.make('pr.type.match-known'),
  description: 'Type in allowed set (standard or custom)',
  preconditions: [Precondition.HasOpenPR.make()],
  check: Effect.gen(function*() {
    const pr = yield* PrService
    const commit = pr.commit

    // Get type value based on commit kind
    const typeValue = ConventionalCommits.Commit.Single.is(commit)
      ? commit.type.value
      : commit.targets[0]!.type.value // Multi: use first target's type

    if (!(typeValue in ConventionalCommits.Type.StandardValue.enums)) {
      return Violation.make({
        location: PrTitle.make({ title: pr.title }),
      })
    }
    return undefined
  }),
})
