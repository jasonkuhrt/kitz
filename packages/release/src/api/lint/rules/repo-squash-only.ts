import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { RepoSettings } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { GitHubService } from '../services/github.js'

export const rule = RuntimeRule.create({
  id: RuleId.make('repo.squash-only'),
  description: 'Only squash merge enabled',
  preconditions: [Precondition.HasGitHubAccess.make()],
  defaults: RuleDefaults.make({ enabled: false }),
  check: Effect.gen(function*() {
    const github = yield* GitHubService
    const { settings } = github

    // Squash-only means: squash allowed, others disabled
    const isSquashOnly = settings.allowSquashMerge && !settings.allowMergeCommit && !settings.allowRebaseMerge

    if (!isSquashOnly) {
      return Violation.make({
        location: RepoSettings.make(),
      })
    }
    return undefined
  }),
})
