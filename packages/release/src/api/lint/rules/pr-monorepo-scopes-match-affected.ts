import { Effect, HashSet } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { DiffService } from '../services/diff.js'
import { PrService } from '../services/pr.js'
import { getInvalidTitleViolation, getParsedCommit } from './pr-helpers.js'
import { ConventionalCommits } from '@kitz/conventional-commits'

/** Verifies that PR title scopes match the packages actually affected by the diff. */
export const rule = RuntimeRule.create({
  id: RuleId.make('pr.monorepo.scopes.match-affected'),
  description: 'Scope(s) match affected packages',
  preconditions: [
    Precondition.HasOpenPR.make(),
    Precondition.IsMonorepo.make(),
    Precondition.HasDiff.make(),
  ],
  check: Effect.gen(function* () {
    const pr = yield* PrService
    const diff = yield* DiffService
    const invalidTitle = getInvalidTitleViolation(pr)
    if (invalidTitle) return invalidTitle
    const scopes = ConventionalCommits.Commit.scopes(getParsedCommit(pr)!)
    const affected = HashSet.fromIterable(diff.affectedPackages)

    // Check if all scopes are in affected packages
    for (const scope of scopes) {
      if (!HashSet.has(affected, scope)) {
        return Violation.make({
          location: PrTitle.make({ title: pr.title }),
        })
      }
    }
    return undefined
  }),
})
