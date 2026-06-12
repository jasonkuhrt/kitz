import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect, HashSet } from 'effect'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Hint, Violation } from '../models/violation.js'
import { MonorepoService } from '../services/monorepo.js'
import { summarizePackages } from './package-manifest-shared.js'
import { withParsedTitle } from './pr-helpers.js'

/** Verifies that PR title scopes correspond to known packages in the monorepo. */
export const rule = RuntimeRule.create({
  id: RuleId.make('pr.monorepo.scopes.match-known'),
  description: 'Scope(s) exist in package map',
  preconditions: ['hasOpenPR', 'isMonorepo'],
  check: () =>
    withParsedTitle((commit, pr) =>
      Effect.gen(function* () {
        const monorepo = yield* MonorepoService
        const scopes = ConventionalCommits.Commit.scopes(commit)
        const validScopes = HashSet.fromIterable(monorepo.validScopes)

        const unknownScopes = scopes.filter((scope) => !HashSet.has(validScopes, scope))
        if (unknownScopes.length === 0) return undefined

        return Violation.make({
          location: PrTitle.make({ title: pr.title }),
          summary: `Scope(s) ${unknownScopes.map((scope) => `"${scope}"`).join(', ')} are not known monorepo packages.`,
          detail: `Known scopes: ${summarizePackages([...monorepo.validScopes])}.`,
          hints: [
            Hint.make({
              description: 'Use a scope from the monorepo package map in the PR title.',
            }),
          ],
        })
      }),
    ),
})
