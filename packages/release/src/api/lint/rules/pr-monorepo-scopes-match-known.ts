import { Effect, HashSet } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { MonorepoService } from '../services/monorepo.js'
import { PrService } from '../services/pr.js'
import { getInvalidTitleViolation, getParsedCommit } from './pr-helpers.js'
import { ConventionalCommits } from '@kitz/conventional-commits'

/** Verifies that PR title scopes correspond to known packages in the monorepo. */
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('pr.monorepo.scopes.match-known'),
  description: 'Scope(s) exist in package map',
  preconditions: [new Precondition.HasOpenPR(), new Precondition.IsMonorepo()],
  check: Effect.gen(function* () {
    const pr = yield* PrService
    const monorepo = yield* MonorepoService
    const invalidTitle = getInvalidTitleViolation(pr)
    if (invalidTitle) return invalidTitle
    const scopes = ConventionalCommits.Commit.scopes(getParsedCommit(pr)!)
    const validScopes = HashSet.fromIterable(monorepo.validScopes)

    // Check if all scopes are valid package names
    for (const scope of scopes) {
      if (!HashSet.has(validScopes, scope)) {
        return new Violation({
          location: new PrTitle({ title: pr.title }),
        })
      }
    }
    return undefined
  }),
})
