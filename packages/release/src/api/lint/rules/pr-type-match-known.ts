import { Effect } from 'effect'
import * as CommitPolicy from '../../commit-policy.js'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { PrTitle } from '../models/violation-location.js'
import { FixStep, GuideFix, Violation } from '../models/violation.js'
import { ConventionalCommitSettingsService } from '../services/conventional-commit-settings.js'
import { withParsedTitle } from './pr-helpers.js'

/** Verifies that every PR title type is recognized (standard or configured). */
export const rule = RuntimeRule.create({
  id: RuleId.make('pr.type.match-known'),
  description: 'Type(s) use recognized conventional-commit kinds',
  preconditions: ['hasOpenPR'],
  check: () =>
    withParsedTitle((commit, pr) =>
      Effect.gen(function* () {
        const { resolvedTypes } = yield* ConventionalCommitSettingsService

        const unknownTypes = CommitPolicy.findUnknownTypes(commit, resolvedTypes)

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
    ),
})
