/**
 * @module cli/commands/lint
 *
 * Run release-specific lint rules and report violations.
 *
 * Validates PR format, git state, npm authentication, and plan correctness.
 * Rules can be filtered with `--only-rule` and `--skip-rule` patterns.
 * Exits with code 1 if any violations are found.
 */
import { NodeContext } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Cause, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'
import * as Preconditions from '../../api/lint/services/preconditions.js'

const LintViolationsSchema = Schema.Struct({
  _tag: Schema.Literal('LintViolations'),
})
const isLintViolations = Schema.is(LintViolationsSchema)

/**
 * release lint
 *
 * Run lint rules and report violations.
 */
const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Run lint rules and report violations')
  .parameter(
    'only-rule',
    Schema.UndefinedOr(Schema.Array(Schema.String)).pipe(
      Schema.annotations({ description: 'Only run matching rules (comma-separated patterns)' }),
    ),
  )
  .parameter(
    'skip-rule',
    Schema.UndefinedOr(Schema.Array(Schema.String)).pipe(
      Schema.annotations({ description: 'Skip matching rules (comma-separated patterns)' }),
    ),
  )
  .parameter(
    'format f',
    Schema.UndefinedOr(Schema.Literal('text', 'json')).pipe(
      Schema.annotations({ description: 'Output format (text or json)' }),
    ),
  )
  .parse()

Cli.run(
  Layer.mergeAll(
    Env.Live,
    NodeContext.layer,
    Preconditions.DefaultLayer,
    Api.Lint.DefaultServicesLayer,
    Api.Lint.ReleasePlan.DefaultReleasePlanLayer,
    Git.GitLive,
  ),
  {
    onError: (cause) => {
      const error = Cause.squash(cause)
      // LintViolations already printed by relay, just exit
      if (isLintViolations(error)) {
        process.exit(1)
      }
      Err.logUnsafe(Err.ensure(error))
      process.exit(1)
    },
  },
)(
  Effect.gen(function* () {
    const config = yield* Api.Config.load({
      lint: {
        onlyRules: args.onlyRule,
        skipRules: args.skipRule,
      },
    })

    // Run check
    const report = yield* Api.Lint.check({ config: config.lint })

    // Relay results
    yield* Api.Lint.relay({
      report,
      format: args.format,
    })

    // Fail if any violations
    const hasViolations = report.results.some(
      (r) => Api.Lint.Finished.is(r) && r.violation !== undefined,
    )

    if (hasViolations) {
      return yield* Effect.fail({ _tag: 'LintViolations' })
    }
  }),
)
