import { NpmRegistry } from '@kitz/npm-registry'
import { Effect, Schema } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment } from '../models/violation-location.js'
import { RuleOptionsService } from '../services/rule-options.js'

const OptionsSchema = Schema.Struct({
  registry: Schema.optional(Schema.String),
})
type Options = typeof OptionsSchema.Type

interface Metadata {
  readonly username: string
}

/** Verifies that npm CLI is authenticated (can run `npm whoami`). */
export const rule = RuntimeRule.create({
  id: RuleId.make('env.npm-authenticated'),
  description: 'npm auth is configured (npm whoami succeeds)',
  preventsDescriptions: [
    'npm publish failing because your npm session or token is missing, expired, or scoped incorrectly',
  ],
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [],
  optionsSchema: OptionsSchema,
  check: Effect.gen(function* () {
    const options = (yield* RuleOptionsService) as Options
    const whoamiOptions = options.registry ? { registry: options.registry } : undefined

    const result = yield* NpmRegistry.Cli.whoami(whoamiOptions).pipe(
      Effect.map((username) => ({ metadata: { username } })),
      Effect.catchAll((error) =>
        Effect.succeed({
          violation: Violation.make({
            location: Environment.make({
              message:
                (error.context.detail ?? 'npm auth failed') +
                '. Run `npm login` or set NPM_TOKEN in your environment.',
            }),
            summary: 'npm CLI authentication is not configured for this runtime.',
            detail:
              'Manual and token-based release paths still rely on npm CLI auth. ' +
              'If `npm whoami` fails here, `npm publish` will fail later after release planning is already complete.',
            hints: [
              Hint.make({
                description: 'For local/manual releases, run `npm login` before `release apply`.',
              }),
              Hint.make({
                description:
                  'For CI, either export an npm token or switch the lifecycle to github-trusted publishing.',
              }),
            ],
            docs: [
              DocLink.make({
                label: 'npm CI/CD auth guidance',
                url: 'https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow/',
              }),
            ],
          }),
        }),
      ),
    )
    return result
  }),
})
