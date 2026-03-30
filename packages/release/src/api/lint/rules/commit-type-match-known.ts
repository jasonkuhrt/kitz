import { ConventionalCommits } from '@kitz/conventional-commits'
import { Git } from '@kitz/git'
import { Effect, Result, Schema } from 'effect'
import { RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { GitHistory } from '../models/violation-location.js'
import { FixStep, GuideFix, Violation } from '../models/violation.js'
import { ConventionalCommitSettingsService } from '../services/conventional-commit-settings.js'
import { RuleOptionsService } from '../services/rule-options.js'

const OptionsSchema = Schema.Struct({
  since: Schema.optional(Schema.String),
})
type Options = typeof OptionsSchema.Type

/** Verifies that every commit type in the analyzed range is recognized (standard or configured). */
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('commit.type.match-known'),
  description: 'Commit type(s) use recognized conventional-commit kinds',
  preconditions: [],
  optionsSchema: OptionsSchema,
  check: Effect.gen(function* () {
    const { resolvedTypes } = yield* ConventionalCommitSettingsService
    const options = (yield* RuleOptionsService) as Options

    const git = yield* Git.Git
    const commits = yield* git.getCommitsSince(options.since)

    for (const commit of commits) {
      const title = commit.message.split('\n')[0] ?? commit.message
      const parseResult = yield* Effect.result(ConventionalCommits.Title.parse(title))
      if (Result.isFailure(parseResult)) continue

      const parsed = parseResult.success
      const types = ConventionalCommits.Commit.types(parsed)

      for (const type of types) {
        if (!(type.value in resolvedTypes)) {
          return Violation.make({
            location: GitHistory.make({ sha: commit.hash }),
            summary: `Commit ${commit.hash.slice(0, 7)} uses unrecognized type "${type.value}".`,
            detail:
              'Unrecognized commit types are excluded from version analysis. ' +
              'If this type should trigger a release, add it to your release config. ' +
              'Rewriting git history is possible but rarely recommended.',
            fix: GuideFix.make({
              summary: 'Add the type to release config or rewrite history.',
              steps: [
                FixStep.make({
                  description: `Add \`${type.value}: '<bump>'\` to \`conventionalCommitSettings.types\` in release.config.ts (recommended).`,
                }),
                FixStep.make({
                  description: `Rewrite the commit to use a recognized type (not usually recommended).`,
                }),
              ],
            }),
          })
        }
      }
    }

    return undefined
  }),
})
