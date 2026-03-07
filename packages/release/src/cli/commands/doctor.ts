/**
 * @module cli/commands/doctor
 *
 * Run release-specific doctor checks and report violations.
 *
 * Validates PR format, git state, publish-channel readiness, and plan correctness.
 * If `.release/plan.json` exists, doctor automatically evaluates plan-aware rules
 * against the active lifecycle and the packages that would be published.
 * Rules can be filtered with `--onlyRule` and `--skipRule` patterns.
 * Exits with code 1 only if error-severity violations are found.
 */
import { NodeContext } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Cause, Effect, Layer, Option, Schema } from 'effect'
import * as Api from '../../api/__.js'
import * as Preconditions from '../../api/lint/services/preconditions.js'

const LintViolationsSchema = Schema.Struct({
  _tag: Schema.Literal('LintViolations'),
})
const isLintViolations = Schema.is(LintViolationsSchema)
const parseCsvStrings = (value: string | undefined): readonly string[] | undefined => {
  if (value === undefined) return undefined

  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  return parts.length > 0 ? parts : undefined
}

/**
 * release doctor
 *
 * Run doctor checks and report violations.
 */
const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Run doctor checks and report violations (plan-aware when .release/plan.json exists)')
  .parameter(
    'only-rule',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({ description: 'Only run matching rules (comma-separated patterns)' }),
    ),
  )
  .parameter(
    'skip-rule',
    Schema.UndefinedOr(Schema.String).pipe(
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
        onlyRules: parseCsvStrings(args.onlyRule),
        skipRules: parseCsvStrings(args.skipRule),
      },
    })

    const env = yield* Env.Env
    const planDir = Fs.Path.join(env.cwd, Api.Planner.PLAN_DIR)
    const plan = yield* Api.Planner.resource.read(planDir)

    const releasePlanLayer = Api.Lint.ReleasePlan.make(
      plan.pipe(
        Option.map((value) =>
          [...value.releases, ...value.cascades].map((item) => ({
            packageName: item.package.name,
            packagePath: item.package.path,
            version: item.nextVersion,
          })),
        ),
        Option.getOrElse(() => []),
      ),
    )

    const releaseContextLayer = Api.Lint.ReleaseContext.make({
      lifecycle: plan.pipe(Option.map((value) => value.lifecycle), Option.getOrElse(() => null)),
      publishing: config.publishing,
    })

    const preconditionsLayer = Preconditions.make({
      hasReleasePlan: Option.isSome(plan),
    })

    // Run check
    const report = yield* Api.Lint.check({ config: config.lint }).pipe(
      Effect.provide(Layer.mergeAll(preconditionsLayer, releasePlanLayer, releaseContextLayer)),
    )

    // Relay results
    yield* Api.Lint.relay({
      report,
      format: args.format,
    })

    // Fail if any violations
    const hasViolations = report.results.some(
      (r) =>
        Api.Lint.Finished.is(r) &&
        r.violation !== undefined &&
        Api.Lint.Error.is(r.severity),
    )

    if (hasViolations) {
      return yield* Effect.fail({ _tag: 'LintViolations' })
    }
  }),
)
