import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect, HashSet } from 'effect'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Hint, Violation } from '../models/violation.js'
import { DiffService } from '../services/diff.js'
import { withParsedTitle } from './pr-helpers.js'

/** Verifies that PR title scopes match the packages actually affected by the diff. */
export const rule = RuntimeRule.create({
  id: RuleId.make('pr.monorepo.scopes.match-affected'),
  description: 'Scope(s) match affected packages',
  preconditions: ['hasOpenPR', 'isMonorepo', 'hasDiff'],
  check: () =>
    withParsedTitle((commit, pr) =>
      Effect.gen(function* () {
        const diff = yield* DiffService
        const scopes = ConventionalCommits.Commit.scopes(commit)
        const affected = HashSet.fromIterable(diff.affectedPackages)

        const unmatchedScopes = scopes.filter((scope) => !HashSet.has(affected, scope))
        if (unmatchedScopes.length === 0) return undefined

        return Violation.make({
          location: PrTitle.make({ title: pr.title }),
          summary: `Scope(s) ${unmatchedScopes.map((scope) => `"${scope}"`).join(', ')} do not match any package affected by this PR's diff.`,
          detail:
            diff.affectedPackages.length === 0
              ? 'The diff affects no packages.'
              : `Packages affected by the diff: ${[...diff.affectedPackages].join(', ')}.`,
          hints: [
            Hint.make({
              description:
                'Use scopes matching the packages this PR changes, or update the diff if the scope is intentional.',
            }),
          ],
        })
      }),
    ),
})
