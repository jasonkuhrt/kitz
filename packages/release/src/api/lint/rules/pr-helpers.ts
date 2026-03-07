import type { ConventionalCommits } from '@kitz/conventional-commits'
import { Option } from 'effect'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { PrTitle } from '../models/violation-location.js'
import type { Pr } from '../services/pr.js'

export const getParsedCommit = (
  pr: Pr,
): ConventionalCommits.Commit.Commit | undefined => Option.getOrUndefined(pr.commit)

export const getInvalidTitleViolation = (pr: Pr): Violation | undefined =>
  (() => {
    const detail = Option.getOrUndefined(pr.titleParseError)
    if (detail === undefined) return undefined
    return Violation.make({
      location: PrTitle.make({ title: pr.title }),
      summary: 'PR title is not a valid conventional commit title.',
      detail,
      hints: [
        Hint.make({
          description:
            'Rewrite the PR title using the release conventional commit syntax before running PR doctor checks.',
        }),
      ],
      docs: [
        DocLink.make({
          label: 'Conventional Commits',
          url: 'https://www.conventionalcommits.org/en/v1.0.0/',
        }),
      ],
    })
  })()
