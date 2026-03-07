import { Effect, Schema } from 'effect'
import * as Precondition from '../models/precondition.js'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { PrBody, PrTitle } from '../models/violation-location.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { PrService } from '../services/pr.js'

const OptionsSchema = Schema.Struct({
  titlePattern: Schema.optional(Schema.String),
  bodyPattern: Schema.optional(Schema.String),
})

type Options = typeof OptionsSchema.Type

const compilePattern = (
  pattern: string,
  target: 'title' | 'body',
): Effect.Effect<RegExp, Error> =>
  Effect.try({
    try: () => new RegExp(pattern, 'm'),
    catch: (error) =>
      new Error(
        `Invalid ${target} regex for pr.message.format: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
  })

export const rule = RuntimeRule.create({
  id: RuleId.make('pr.message.format'),
  description: 'Custom regex message enforcement',
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [Precondition.HasOpenPR.make()],
  optionsSchema: OptionsSchema,
  check: Effect.gen(function* () {
    const pr = yield* PrService
    const options = (yield* RuleOptionsService) as Options

    const titleRegex = options.titlePattern
      ? yield* compilePattern(options.titlePattern, 'title')
      : undefined
    const bodyRegex = options.bodyPattern
      ? yield* compilePattern(options.bodyPattern, 'body')
      : undefined

    if (!titleRegex && !bodyRegex) {
      return undefined
    }

    if (titleRegex && !titleRegex.test(pr.title)) {
      return Violation.make({
        location: PrTitle.make({ title: pr.title }),
        summary: 'PR title does not match the configured format.',
        detail: `Expected the PR title to match \`${options.titlePattern}\`.`,
        hints: [
          Hint.make({
            description: 'Adjust the PR title or loosen `pr.message.format.titlePattern`.',
          }),
        ],
        docs: [
          DocLink.make({
            label: 'JavaScript RegExp reference',
            url: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/RegExp',
          }),
        ],
      })
    }

    if (bodyRegex && !bodyRegex.test(pr.body)) {
      return Violation.make({
        location: PrBody.make({}),
        summary: 'PR body does not match the configured format.',
        detail: `Expected the PR body to match \`${options.bodyPattern}\`.`,
        hints: [
          Hint.make({
            description: 'Adjust the PR body or loosen `pr.message.format.bodyPattern`.',
          }),
        ],
        docs: [
          DocLink.make({
            label: 'JavaScript RegExp reference',
            url: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/RegExp',
          }),
        ],
      })
    }

    return undefined
  }),
})
