import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { FixStep, GuideFix, Violation } from '../models/violation.js'
import { ConventionalCommitSettingsService } from '../services/conventional-commit-settings.js'
import { getInvalidTitleViolation, getParsedCommit } from './pr-helpers.js'
import { PrService } from '../services/pr.js'

const isKnownType = (
  type: ConventionalCommits.Type.Type,
  resolvedTypes: Readonly<Record<string, unknown>>,
): boolean => ConventionalCommits.Type.Standard.is(type) || type.value in resolvedTypes

/** Verifies that every PR title type is recognized (standard or configured). */
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('pr.type.match-known'),
  description: 'Type(s) use recognized conventional-commit kinds',
  preconditions: [new Precondition.HasOpenPR()],
  check: Effect.gen(function* () {
    const { resolvedTypes } = yield* ConventionalCommitSettingsService
    const pr = yield* PrService
    const invalidTitle = getInvalidTitleViolation(pr)
    if (invalidTitle) return invalidTitle
    const commit = getParsedCommit(pr)!

    const unknownTypes = ConventionalCommits.Commit.types(commit).filter(
      (type) => !isKnownType(type, resolvedTypes),
    )

    if (unknownTypes.length > 0) {
      const names = unknownTypes.map((t) => `"${t.value}"`).join(', ')
      return Violation.make({
        location: PrTitle.make({ title: pr.title }),
        summary: `Unknown type(s) ${names} in PR title.`,
        fix: GuideFix.make({
          summary: 'Use a recognized type or configure it in release config.',
          steps: [
            FixStep.make({
              description: `Use a standard type (feat, fix, docs, perf, etc.) in the PR title.`,
            }),
            FixStep.make({
              description: `Or add the type to conventionalCommitSettings.types in release.config.ts.`,
            }),
          ],
        }),
      })
    }
    return undefined
  }),
})
