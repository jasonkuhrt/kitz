import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { DiffService } from '../services/diff.js'
import { PrService } from '../services/pr.js'

/** Types that don't trigger releases. */
const noReleaseTypes = new Set(['docs', 'style', 'test', 'ci', 'chore'])

export const rule = RuntimeRule.create({
  id: RuleId.make('pr.type.release-kind-match-diff'),
  description: 'No-release type cannot have src changes',
  preconditions: [Precondition.HasOpenPR.make(), Precondition.HasDiff.make()],
  check: Effect.gen(function*() {
    const pr = yield* PrService
    const diff = yield* DiffService
    const commit = pr.commit

    // Get type value based on commit kind
    const typeValue = ConventionalCommits.Commit.Single.is(commit)
      ? commit.type.value
      : commit.targets[0]!.type.value // Multi: use first target's type

    // If it's a no-release type, check for src changes
    if (noReleaseTypes.has(typeValue)) {
      const hasSrcChanges = diff.files.some((f) => f.path.includes('/src/'))
      if (hasSrcChanges) {
        return Violation.make({
          location: PrTitle.make({ title: pr.title }),
        })
      }
    }
    return undefined
  }),
})
