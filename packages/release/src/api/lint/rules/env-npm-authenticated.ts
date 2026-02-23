import { NpmRegistry } from '@kitz/npm-registry'
import { Effect, Schema } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { RuleOptionsService } from '../services/rule-options.js'
import { Environment } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'

interface Options {
  readonly registry?: string
}

const OptionsSchema = Schema.Struct({
  registry: Schema.optional(Schema.String),
})

interface Metadata {
  readonly username: string
}

export const rule = RuntimeRule.create<Options, Metadata>({
  id: RuleId.make('env.npm-authenticated'),
  description: 'npm auth is configured (npm whoami succeeds)',
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [],
  optionsSchema: OptionsSchema,
  check: Effect.gen(function*() {
    const options = (yield* RuleOptionsService) as Options
    const whoamiOptions = options.registry ? { registry: options.registry } : undefined

    const result = yield* NpmRegistry.Cli.whoami(whoamiOptions).pipe(
      Effect.map((username) => ({ metadata: { username } })),
      Effect.catchAll((error) =>
        Effect.succeed({
          violation: Violation.make({
            location: Environment.make({
              message: error.context.detail ?? 'npm auth failed',
            }),
          }),
        })
      ),
    )
    return result
  }),
})
