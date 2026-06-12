import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect, Schema } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { CommandFix, DocLink, Hint, Violation } from '../models/violation.js'
import { PrTitle } from '../models/violation-location.js'
import { withParsedTitle } from './pr-helpers.js'

const OptionsSchema = Schema.Struct({
  projectedHeader: Schema.String,
})

export const rule = RuntimeRule.create({
  id: RuleId.make('pr.projected-squash-commit-sync'),
  description: 'PR title header matches the canonical squash-merge header',
  preventsDescriptions: [
    'GitHub using a squash-merge title whose conventional-commit header drifts from the canonical release header.',
  ],
  preconditions: ['hasOpenPR'],
  defaults: RuleDefaults.make({
    enabled: 'auto',
    severity: 'warn',
  }),
  optionsSchema: OptionsSchema,
  check: (options) =>
    withParsedTitle((commit, pr) =>
      Effect.sync(() => {
        const actualHeader = ConventionalCommits.Commit.renderHeader(commit)

        if (actualHeader !== options.projectedHeader) {
          return Violation.make({
            location: PrTitle.make({ title: pr.title }),
            summary: 'PR title header is out of sync with the projected squash-merge header.',
            detail: `Expected header \`${options.projectedHeader}\`, but PR title header is \`${actualHeader}\`.`,
            fix: CommandFix.make({
              summary: 'Apply the canonical release header to the connected PR title.',
              command: 'release pr title apply',
              docs: [
                DocLink.make({
                  label: 'GitHub squash merge defaults',
                  url: 'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests',
                }),
              ],
            }),
            hints: [
              Hint.make({
                description:
                  'Rename the PR title header so GitHub’s default squash-merge title starts with the computed release header.',
              }),
            ],
            docs: [
              DocLink.make({
                label: 'GitHub squash merge defaults',
                url: 'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests',
              }),
            ],
          })
        }

        return {
          metadata: { projectedHeader: options.projectedHeader },
        }
      }),
    ),
})
