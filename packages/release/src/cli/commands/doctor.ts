/**
 * @module cli/commands/doctor
 *
 * Run release-specific doctor checks across one or more release lifecycles.
 *
 * By default, doctor scopes to `.release/plan.json` when it exists so the
 * command validates the exact plan you are about to apply. Without an active
 * plan, doctor evaluates official and candidate release readiness from current
 * repo state, adding ephemeral when PR context is available. Use `--all` to
 * force every lifecycle, or `--lifecycle` to focus one.
 *
 * Rules can be filtered with `--onlyRule` and `--skipRule`.
 * Exits with code 1 when required lifecycle checks cannot be evaluated or
 * when any checked lifecycle reports error-severity violations.
 */
import { NodeContext, NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Cause, Console, Effect, Layer, Schema } from 'effect'
import * as Api from '../../api/__.js'

const DoctorFailuresSchema = Schema.Struct({
  _tag: Schema.Literal('DoctorFailures'),
})
const isDoctorFailures = Schema.is(DoctorFailuresSchema)

const parseCsvStrings = (value: string | undefined): readonly string[] | undefined => {
  if (value === undefined) return undefined

  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  return parts.length > 0 ? parts : undefined
}

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description(
    'Run doctor checks (default: active plan if present, otherwise official and candidate; add ephemeral when PR context exists)',
  )
  .parameter(
    'lifecycle l',
    Schema.UndefinedOr(Schema.Literal('official', 'candidate', 'ephemeral')).pipe(
      Schema.annotations({ description: 'Only evaluate a single release lifecycle' }),
    ),
  )
  .parameter(
    'all a',
    Schema.transform(Schema.UndefinedOr(Schema.Boolean), Schema.Boolean, {
      strict: true,
      decode: (value) => value ?? false,
      encode: (value) => value,
    }).pipe(
      Schema.annotations({
        description: 'Force all lifecycles, including ephemeral without detected PR context',
        default: false,
      }),
    ),
  )
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
    NodeFileSystem.layer,
    Api.Lint.Preconditions.DefaultLayer,
    Api.Lint.DefaultServicesLayer,
    Api.Lint.ReleasePlan.DefaultReleasePlanLayer,
    Git.GitLive,
  ),
  {
    onError: (cause) => {
      const error = Cause.squash(cause)
      if (isDoctorFailures(error)) {
        process.exit(1)
      }
      Err.logUnsafe(Err.ensure(error))
      process.exit(1)
    },
  },
)(
  Effect.gen(function* () {
    const env = yield* Env.Env
    const git = yield* Git.Git

    if (args.lifecycle && args.all) {
      yield* Console.error('Choose either --lifecycle or --all, not both.')
      return yield* Effect.fail({ _tag: 'DoctorFailures' })
    }

    const config = yield* Api.Config.load({
      lint: {
        onlyRules: parseCsvStrings(args.onlyRule),
        skipRules: parseCsvStrings(args.skipRule),
      },
    })
    const packages = yield* Api.Analyzer.Workspace.resolvePackages(config.packages)

    if (packages.length === 0) {
      yield* Console.log(
        'No packages found. Check release.config.ts `packages` field ' +
          'or ensure pnpm-workspace.yaml defines workspace packages.',
      )
      return
    }

    const planDir = Fs.Path.join(env.cwd, Api.Planner.PLAN_DIR)
    const activePlan = yield* Api.Planner.resource.read(planDir)
    const needsSmartScope = !args.lifecycle && !args.all && activePlan._tag !== 'Some'
    const prNumberAttempt = needsSmartScope
      ? yield* Api.Explorer.resolvePrNumber().pipe(Effect.either)
      : { _tag: 'Right' as const, right: null }
    const hasPrContext = prNumberAttempt._tag === 'Right' && prNumberAttempt.right !== null
    const scope = Api.Doctor.resolveScope({
      ...(args.lifecycle ? { lifecycle: args.lifecycle } : {}),
      ...(args.all ? { all: true } : {}),
      ...(activePlan._tag === 'Some' ? { activePlan: activePlan.value } : {}),
      hasPrContext,
    })

    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({ packages, tags })
    const currentBranch = yield* git.getCurrentBranch()

    const reports: Api.Doctor.LifecycleReport[] = []
    const evaluatePlan = (plan: Api.Planner.Plan, required: boolean) =>
      Effect.gen(function* () {
        const plannedItems = [...plan.releases, ...plan.cascades]
        const report = yield* Api.Lint.check({ config: config.lint }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Api.Lint.DefaultServicesLayer,
              Api.Lint.Preconditions.make({ hasReleasePlan: true }),
              Api.Lint.ReleasePlan.make(
                plannedItems.map((item) => ({
                  packageName: item.package.name,
                  packagePath: item.package.path,
                  version: item.nextVersion,
                })),
              ),
              Api.Lint.ReleaseContext.make({
                lifecycle: plan.lifecycle,
                publishing: config.publishing,
                trunk: config.trunk,
                currentBranch,
              }),
            ),
          ),
        )

        reports.push({
          _tag: 'CheckedLifecycleReport' as const,
          lifecycle: plan.lifecycle,
          required,
          plannedPackages: plannedItems.length,
          report,
        })
      })
    if (scope._tag === 'ActivePlanScope') {
      yield* evaluatePlan(scope.plan, true)
    } else {
      for (const target of scope.lifecycles) {
        const planAttempt = yield* (
          target.lifecycle === 'official'
            ? Api.Planner.official(analysis, { packages })
            : target.lifecycle === 'candidate'
              ? Api.Planner.candidate(analysis, { packages })
              : Api.Planner.ephemeral(analysis, { packages })
        ).pipe(Effect.either)

        if (planAttempt._tag === 'Left') {
          reports.push({
            _tag: 'UnavailableLifecycleReport' as const,
            lifecycle: target.lifecycle,
            required: target.required,
            reason: planAttempt.left.message,
          })
          continue
        }

        yield* evaluatePlan(planAttempt.right, target.required)
      }
    }

    const evaluation = {
      currentBranch,
      trunk: config.trunk,
      scope:
        scope._tag === 'ActivePlanScope'
          ? `active plan (${scope.plan.lifecycle})`
          : 'computed lifecycle scenarios',
      reports,
    } satisfies Api.Doctor.DoctorEvaluation

    if (args.format === 'json') {
      yield* Console.log(JSON.stringify(evaluation, null, 2))
    } else {
      yield* Console.log(Api.Doctor.formatEvaluation(evaluation))
    }

    if (Api.Doctor.hasBlockingIssues(evaluation)) {
      return yield* Effect.fail({ _tag: 'DoctorFailures' })
    }
  }),
)
