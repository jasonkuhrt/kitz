import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect, HashSet } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { DiffService } from '../services/diff.js'
import { PrService } from '../services/pr.js'
import { getInvalidTitleViolation, getParsedCommit } from './pr-helpers.js'

/** Types that don't trigger releases. */
const noReleaseTypes = HashSet.make('docs', 'style', 'test', 'ci', 'chore')

const isNoReleaseFacet = (facet: ConventionalCommits.Commit.Facet): boolean =>
  !facet.breaking &&
  ConventionalCommits.Type.Standard.is(facet.type) &&
  HashSet.has(noReleaseTypes, facet.type.value)

/** Verifies that no-release PR types are not used for source changes. */
export const rule = RuntimeRule.create({
  id: RuleId.make('pr.type.release-kind-match-diff'),
  description: 'No-release type cannot have src changes',
  preconditions: [Precondition.HasOpenPR.make(), Precondition.HasDiff.make()],
  check: Effect.gen(function* () {
    const pr = yield* PrService
    const diff = yield* DiffService
    const invalidTitle = getInvalidTitleViolation(pr)
    if (invalidTitle) return invalidTitle
    const commit = getParsedCommit(pr)!

    const hasSrcChanges = diff.files.some((f) => f.path.includes('/src/'))
    if (!hasSrcChanges) return undefined

    const facets = ConventionalCommits.Commit.facets(commit)
    if (facets.length > 0 && facets.every(isNoReleaseFacet)) {
      return Violation.make({
        location: PrTitle.make({ title: pr.title }),
      })
    }

    return undefined
  }),
})
