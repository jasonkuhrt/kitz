import { ConventionalCommits } from '@kitz/conventional-commits'
import { Effect, Schema } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as Severity from '../models/severity.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
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
  id: RuleId.make('pr.projected-squash-commit-sync'),
  description: 'PR title header matches the canonical squash-merge header',
  preventsDescriptions: [
    'GitHub using a squash-merge title whose conventional-commit header drifts from the canonical release header.',
  ],
  preconditions: [Precondition.HasOpenPR.make()],
  defaults: RuleDefaults.make({
    enabled: 'auto',
    severity: Severity.Warn.make(),
  }),
  optionsSchema: OptionsSchema,
  check: Effect.gen(function* () {
    const pr = yield* PrService
    const options = (yield* RuleOptionsService) as Options
    const invalidTitle = getInvalidTitleViolation(pr)
    if (invalidTitle) return invalidTitle
    const actualHeader = ConventionalCommits.Commit.renderHeader(getParsedCommit(pr)!)

    if (actualHeader !== options.projectedHeader) {
      return Violation.make({
        location: PrTitle.make({ title: pr.title }),
        summary: 'PR title header is out of sync with the projected squash-merge header.',
        detail: `Expected header \`${options.projectedHeader}\`, but PR title header is \`${actualHeader}\`.`,
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
      metadata: Metadata.make(options.projectedHeader),
    }
  }),
})
