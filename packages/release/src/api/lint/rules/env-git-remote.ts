import { Git } from '@kitz/git'
import { Effect, Schema } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { DocLink, Hint, Violation } from '../models/violation.js'
import { Environment } from '../models/violation-location.js'
import { RuleOptionsService } from '../services/rule-options.js'

const OptionsSchema = Schema.Struct({
  remote: Schema.optional(Schema.String),
})
type Options = typeof OptionsSchema.Type

interface Metadata {
  readonly url: string
}

/** Verifies that the git remote (default: origin) is configured and reachable. */
export const rule = RuntimeRule.create({
  id: RuleId.makeUnsafe('env.git-remote'),
  description: 'git remote is configured and reachable',
  preventsDescriptions: [
    'tag push failures because the release remote is missing, misnamed, or unreachable',
  ],
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [],
  optionsSchema: OptionsSchema,
  check: Effect.gen(function* () {
    const options = (yield* RuleOptionsService) as Options
    const git = yield* Git.Git
    const remote = options.remote ?? 'origin'

    const result = yield* git.getRemoteUrl(remote).pipe(
      Effect.match({
        onSuccess: (url) => ({ metadata: { url } }),
        onFailure: (error) => ({
          violation: Violation.make({
            location: Environment.make({
              message: `Git remote '${remote}' not configured or unreachable: ${error.message}`,
            }),
            summary: `Release tags cannot be pushed because git remote "${remote}" is unavailable.`,
            detail:
              'Release apply publishes packages and then pushes tags. If the configured remote cannot be resolved or reached, the publish can succeed while the git release markers fail to leave your machine.',
            hints: [
              Hint.make({
                description: `Ensure \`${remote}\` points at the canonical repo and is reachable from this machine.`,
              }),
              Hint.make({
                description:
                  'If you publish from a fork or alternate remote name, rerun the check with the matching remote option.',
              }),
            ],
            docs: [
              DocLink.make({
                label: 'Git remotes',
                url: 'https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes',
              }),
            ],
          }),
        }),
      }),
    )

    return result
  }),
})
