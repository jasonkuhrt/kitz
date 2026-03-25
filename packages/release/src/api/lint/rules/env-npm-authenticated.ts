import { NpmRegistry } from '@kitz/npm-registry'
import { Effect, Schema } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, FixStep, GuideFix, Hint, Violation } from '../models/violation.js'
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
  id: RuleId.makeUnsafe('env.npm-authenticated'),
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
      Effect.match({
        onSuccess: (username) => ({ metadata: { username } }),
        onFailure: (error) => ({
          violation: Violation.make({
            location: Environment.make({
              message:
                (error.context.detail ?? 'npm auth failed') +
                '. Run `npm login` or set NPM_TOKEN in your environment.',
            }),
            summary: 'npm CLI authentication is not configured for this runtime.',
            detail:
              'Manual and token-based release paths still rely on npm CLI auth. ' +
              'If `npm whoami` fails here, `npm publish` will fail later after release planning is already complete. ' +
              'Even after login, publish can still fail if the authenticated account lacks write access to the target package or scope, or if npm requires an additional write-time auth step.',
            fix: GuideFix.make({
              summary: 'Sign this machine into npm and re-run the auth check.',
              steps: [
                FixStep.make({
                  description: 'Open the npm login docs to confirm the current CLI flow.',
                }),
                FixStep.make({
                  description:
                    'Run `npm login` in this shell and complete the browser or terminal prompts.',
                }),
                FixStep.make({
                  description: 'Verify the session with `npm whoami`.',
                }),
                FixStep.make({
                  description: 'Re-run `release doctor --onlyRule env.npm-authenticated`.',
                }),
                FixStep.make({
                  description:
                    'If `npm whoami` passes but publish still fails, verify scope ownership, package write access, and any write-time 2FA requirement on the npm account.',
                }),
              ],
              docs: [
                DocLink.make({
                  label: 'npm login',
                  url: 'https://docs.npmjs.com/cli/v11/commands/npm-login',
                }),
                DocLink.make({
                  label: 'npm access',
                  url: 'https://docs.npmjs.com/cli/v11/commands/npm-access',
                }),
                DocLink.make({
                  label: 'npm two-factor authentication',
                  url: 'https://docs.npmjs.com/configuring-two-factor-authentication/',
                }),
              ],
            }),
            hints: [
              Hint.make({
                description:
                  'For CI, either export an npm token or switch the lifecycle to github-trusted publishing.',
              }),
              Hint.make({
                description:
                  'If `npm whoami` starts passing but publish still fails, check npm package ownership or org membership for the target scope and any write-time 2FA policy on the account.',
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
      }),
    )
    return result
  }),
})
