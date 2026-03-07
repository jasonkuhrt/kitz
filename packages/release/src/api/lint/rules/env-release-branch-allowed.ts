import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment } from '../models/violation-location.js'
import { ReleaseContextService } from '../services/release-context.js'
import { ReleasePlanService } from '../services/release-plan.js'

/** Verifies that official and candidate releases are only run from the configured trunk branch. */
export const rule = RuntimeRule.create({
  id: RuleId.make('env.release-branch-allowed'),
  description: 'active branch is allowed for the planned release lifecycle',
  preventsDescriptions: [
    'publishing official or candidate releases from non-trunk branches and tagging code that has not landed on trunk',
  ],
  preconditions: [Precondition.HasReleasePlan.make()],
  check: Effect.gen(function* () {
    const context = yield* ReleaseContextService
    const plan = yield* ReleasePlanService

    if (!context.lifecycle || context.lifecycle === 'ephemeral') return undefined
    if (plan.releases.length === 0) return undefined
    if (!context.trunk || !context.currentBranch) return undefined
    if (context.currentBranch === context.trunk) return undefined

    return Violation.make({
      location: Environment.make({
        message: `Current branch "${context.currentBranch}" does not match configured trunk "${context.trunk}".`,
      }),
      summary: `${context.lifecycle} releases must run from trunk.`,
      detail:
        'Official and candidate releases should describe code that already exists on trunk. ' +
        'Planning or applying them from a feature branch can publish versions that do not match merge history.',
      hints: [
        Hint.make({
          description: `Checkout ${context.trunk} before running ${context.lifecycle} release plan or apply.`,
        }),
        Hint.make({
          description:
            'If your primary release branch has a different name, update `trunk` in release.config.ts.',
        }),
      ],
      docs: [
        DocLink.make({
          label: 'Git branch management',
          url: 'https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell',
        }),
      ],
    })
  }),
})
