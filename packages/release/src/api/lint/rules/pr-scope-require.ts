import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Hint, Violation } from '../models/violation.js'
import { withParsedTitle } from './pr-helpers.js'

/** Requires the PR title to include at least one scope. */
export const rule = RuntimeRule.create({
  id: RuleId.make('pr.scope.require'),
  description: 'At least one scope required',
  preconditions: ['hasOpenPR'],
  defaults: RuleDefaults.make({ enabled: false }),
  check: () =>
    withParsedTitle((commit, pr) =>
      Effect.sync(() => {
        const scopes = ConventionalCommits.Commit.scopes(commit)
        if (scopes.length > 0) return undefined

        return Violation.make({
          location: PrTitle.make({ title: pr.title }),
          summary: 'PR title has no scope, but at least one scope is required.',
          hints: [
            Hint.make({
              description: 'Add a scope to the PR title, e.g. `feat(core): ...`.',
            }),
          ],
        })
      }),
    ),
})
