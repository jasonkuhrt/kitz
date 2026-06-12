import { Effect } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { RepoSettings } from '../models/violation-location.js'
import { Hint, Violation } from '../models/violation.js'
import { GitHubService } from '../services/github.js'

/** Verifies that only squash merge is enabled on the GitHub repository. */
export const rule = RuntimeRule.create({
  id: RuleId.make('repo.squash-only'),
  description: 'Only squash merge enabled',
  preconditions: ['hasGitHubAccess'],
  defaults: RuleDefaults.make({ enabled: false }),
  check: () =>
    Effect.gen(function* () {
      const github = yield* GitHubService
      const { settings } = github

      // Squash-only means: squash allowed, others disabled
      const isSquashOnly =
        settings.allowSquashMerge && !settings.allowMergeCommit && !settings.allowRebaseMerge

      if (!isSquashOnly) {
        const enabled = (value: boolean) => (value ? 'enabled' : 'disabled')
        return Violation.make({
          location: RepoSettings.make({}),
          summary: 'Repository merge settings are not squash-only.',
          detail:
            `Current settings — squash merge: ${enabled(settings.allowSquashMerge)}, ` +
            `merge commit: ${enabled(settings.allowMergeCommit)}, ` +
            `rebase merge: ${enabled(settings.allowRebaseMerge)}.`,
          hints: [
            Hint.make({
              description:
                'Enable squash merging and disable merge commits and rebase merging in the GitHub repository settings.',
            }),
          ],
        })
      }
      return undefined
    }),
})
