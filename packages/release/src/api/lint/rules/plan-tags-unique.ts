import { Git } from '@kitz/git'
import { Pkg } from '@kitz/pkg'
import { Effect, HashSet } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { Environment } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { ReleasePlanService } from '../services/release-plan.js'

interface Metadata {
  /** Tags that would conflict. */
  readonly conflictingTags: readonly string[]
  /** All existing tags for reference. */
  readonly existingTags: readonly string[]
}

/** Verifies that planned release tags do not already exist in the git repository. */
export const rule = RuntimeRule.create({
  id: RuleId.make('plan.tags-unique'),
  description: 'planned release tags do not already exist in git',
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [Precondition.HasReleasePlan.make()],
  check: Effect.gen(function* () {
    const plan = yield* ReleasePlanService
    const git = yield* Git.Git

    // Get existing tags
    const existingTags = yield* git.getTags()
    const existingTagSet = HashSet.fromIterable(existingTags)

    // Format planned tags
    const plannedTags = plan.releases.map((r) =>
      Pkg.Pin.toString(Pkg.Pin.Exact.make({ name: r.packageName, version: r.version })),
    )

    // Find conflicts
    const conflictingTags = plannedTags.filter((tag) => HashSet.has(existingTagSet, tag))

    if (conflictingTags.length > 0) {
      return {
        violation: Violation.make({
          location: Environment.make({
            message: `Tags already exist: ${conflictingTags.join(
              ', ',
            )}. Use a different version or delete the existing tags.`,
          }),
        }),
        metadata: { conflictingTags, existingTags },
      }
    }

    return { metadata: { conflictingTags: [], existingTags } }
  }),
})
