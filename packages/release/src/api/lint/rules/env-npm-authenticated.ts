import { NpmRegistry } from '@kitz/npm-registry'
import { Effect } from 'effect'
import { RuleDefaults, RuleId } from '../models/rule-defaults.js'
import * as RuntimeRule from '../models/runtime-rule.js'
import { Environment } from '../models/violation-location.js'
import { Violation } from '../models/violation.js'

interface Metadata {
  readonly username: string
}

export const rule = RuntimeRule.create<unknown, Metadata>({
  id: RuleId.make('env.npm-authenticated'),
  description: 'npm auth is configured (npm whoami succeeds)',
  defaults: RuleDefaults.make({ enabled: false }),
  preconditions: [],
  check: Effect.gen(function*() {
    const result = yield* NpmRegistry.Cli.whoami().pipe(
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
