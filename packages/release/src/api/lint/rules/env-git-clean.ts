import { Git } from '@kitz/git'
import { Effect } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment } from '../models/violation-location.js'

/** Verifies that the git working directory has no uncommitted changes before publishing. */
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('env.git-clean'),
  description: 'git working directory has no uncommitted changes',
  preventsDescriptions: [
    'publishing from a dirty working tree and tagging code that does not match committed source',
  ],
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [],
  check: Effect.gen(function* () {
    const git = yield* Git.Git
    const isClean = yield* git.isClean()

    if (!isClean) {
      return Violation.make({
        location: Environment.make({
          message:
            'Working directory has uncommitted changes. Commit or stash your changes before running release apply.',
        }),
        summary: 'Release apply should start from a clean working tree.',
        detail:
          'Publishing from dirty local state can produce tags and npm packages that do not correspond to committed source, which makes the release hard to reproduce or roll back safely.',
        hints: [
          Hint.make({
            description: 'Commit or stash local changes before running `release apply`.',
          }),
          Hint.make({
            description:
              'Regenerate the release plan after switching branches or changing package manifests.',
          }),
        ],
        docs: [
          DocLink.make({
            label: 'Git stash basics',
            url: 'https://git-scm.com/book/en/v2/Git-Tools-Stashing-and-Cleaning',
          }),
        ],
      })
    }
    return undefined
  }),
})
