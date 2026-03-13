import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect, Schema } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as Severity from '../models/severity.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { CommandFix, DocLink, Hint, Violation } from '../models/violation.js'
import { PrTitle } from '../models/violation-location.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { PrService } from '../services/pr.js'
import { getInvalidTitleViolation, getParsedCommit } from './pr-helpers.js'

const Metadata = {
  make: (projectedHeader: string) => ({ projectedHeader }),
}

const OptionsSchema = Schema.Struct({
  projectedHeader: Schema.String,
})

type Options = typeof OptionsSchema.Type

export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('pr.projected-squash-commit-sync'),
  description: 'PR title header matches the canonical squash-merge header',
  preventsDescriptions: [
    'GitHub using a squash-merge title whose conventional-commit header drifts from the canonical release header.',
  ],
  preconditions: [new Precondition.HasOpenPR()],
  defaults: new RuleDefaults({
    enabled: 'auto',
    severity: new Severity.Warn(),
  }),
  optionsSchema: OptionsSchema,
  check: Effect.gen(function* () {
    const pr = yield* PrService
    const options = (yield* RuleOptionsService) as Options
    const invalidTitle = getInvalidTitleViolation(pr)
    if (invalidTitle) return invalidTitle
    const actualHeader = ConventionalCommits.Commit.renderHeader(getParsedCommit(pr)!)

    if (actualHeader !== options.projectedHeader) {
      return new Violation({
        location: new PrTitle({ title: pr.title }),
        summary: 'PR title header is out of sync with the projected squash-merge header.',
        detail: `Expected header \`${options.projectedHeader}\`, but PR title header is \`${actualHeader}\`.`,
        fix: new CommandFix({
          summary: 'Apply the canonical release header to the connected PR title.',
          command: 'release pr title apply',
          docs: [
            new DocLink({
              label: 'GitHub squash merge defaults',
              url: 'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests',
            }),
          ],
        }),
        hints: [
          new Hint({
            description:
              'Rename the PR title header so GitHub’s default squash-merge title starts with the computed release header.',
          }),
        ],
        docs: [
          new DocLink({
            label: 'GitHub squash merge defaults',
            url: 'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests',
          }),
        ],
      })
    }

    return {
      metadata: Metadata.make(options.projectedHeader),
    }
  }),
})
