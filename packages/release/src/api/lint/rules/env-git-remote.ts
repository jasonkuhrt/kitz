import { Git } from '@kitz/git'
import { Effect, Schema } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { Environment } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'
import { RuleOptionsService } from '../services/rule-options.js'

interface Options {
  readonly remote?: string
}

const OptionsSchema = Schema.Struct({
  remote: Schema.optional(Schema.String),
})

interface Metadata {
  readonly url: string
}

export const rule = RuntimeRule.create<Options, Metadata>({
  id: RuleId.make('env.git-remote'),
  description: 'git remote is configured and reachable',
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [],
  optionsSchema: OptionsSchema,
  check: Effect.gen(function*() {
    const options = yield* RuleOptionsService
    const git = yield* Git.Git
    const remote = (options as Options).remote ?? 'origin'

    const result = yield* git.getRemoteUrl(remote).pipe(
      Effect.map((url) => ({ metadata: { url } })),
      Effect.catchAll((error) =>
        Effect.succeed({
          violation: Violation.make({
            location: Environment.make({
              message: `Git remote '${remote}' not configured or unreachable: ${error.message}`,
            }),
          }),
        })
      ),
    )

    return result
  }),
})
