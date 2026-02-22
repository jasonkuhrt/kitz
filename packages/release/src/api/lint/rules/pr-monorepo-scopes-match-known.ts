import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { MonorepoService } from '../services/monorepo.js'
import { PrService } from '../services/pr.js'

/** Get scopes from a commit (Single or Multi). */
const getScopes = (commit: ConventionalCommits.Commit.Commit): readonly string[] => {
  if (ConventionalCommits.Commit.Single.is(commit)) {
    return commit.scopes
  }
  return commit.targets.map((t) => t.scope)
}

export const rule = RuntimeRule.create({
  id: RuleId.make('pr.monorepo.scopes.match-known'),
  description: 'Scope(s) exist in package map',
  preconditions: [Precondition.HasOpenPR.make(), Precondition.IsMonorepo.make()],
  check: Effect.gen(function*() {
    const pr = yield* PrService
    const monorepo = yield* MonorepoService
    const scopes = getScopes(pr.commit)
    const validScopes = new Set(monorepo.validScopes)

    // Check if all scopes are valid package names
    for (const scope of scopes) {
      if (!validScopes.has(scope)) {
        return Violation.make({
          location: PrTitle.make({ title: pr.title }),
        })
      }
    }
    return undefined
  }),
})
