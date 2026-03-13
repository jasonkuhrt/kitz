import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect, HashSet } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { CommandFix, DocLink, Hint, Violation } from '../models/violation.js'
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
  id: RuleId.makeUnsafe('pr.type.release-kind-match-diff'),
  description: 'No-release type cannot have src changes',
  preconditions: [new Precondition.HasOpenPR(), new Precondition.HasDiff()],
  check: Effect.gen(function* () {
    const pr = yield* PrService
    const diff = yield* DiffService
    const invalidTitle = getInvalidTitleViolation(pr)
    if (invalidTitle) return invalidTitle
    const commit = getParsedCommit(pr)!

    const srcChanges = diff.files.filter((file) => file.path.includes('/src/'))
    const hasSrcChanges = srcChanges.length > 0
    if (!hasSrcChanges) return undefined

    const facets = ConventionalCommits.Commit.facets(commit)
    if (facets.length > 0 && facets.every(isNoReleaseFacet)) {
      const changedPaths = srcChanges
        .slice(0, 3)
        .map((file) => `\`${file.path}\``)
        .join(', ')
      const changedSummary =
        srcChanges.length > 3
          ? `${changedPaths}, and ${String(srcChanges.length - 3)} more`
          : changedPaths

      return Violation.make({
        location: PrTitle.make({ title: pr.title }),
        summary:
          'PR title uses a no-release kind, but src changes require a release-triggering header.',
        detail:
          `This PR changes source files (${changedSummary}), so squash merge should use a release-triggering header ` +
          'such as `feat`, `fix`, or a breaking change. As written, the PR title advertises that no release should happen.',
        fix: CommandFix.make({
          summary: 'Rewrite the PR title header to the canonical release header.',
          command: 'release pr title apply',
          docs: [
            DocLink.make({
              label: 'Conventional Commits',
              url: 'https://www.conventionalcommits.org/en/v1.0.0/',
            }),
          ],
        }),
        hints: [
          Hint.make({
            description:
              'If the source changes are intentional and release-worthy, use `release pr title apply` to align the PR title with the computed release header.',
          }),
          Hint.make({
            description:
              'If these changes truly should not release, move the non-release edits out of `src/` or split the work into separate PRs.',
          }),
        ],
        docs: [
          DocLink.make({
            label: 'Conventional Commits',
            url: 'https://www.conventionalcommits.org/en/v1.0.0/',
          }),
        ],
      })
    }

    return undefined
  }),
})
