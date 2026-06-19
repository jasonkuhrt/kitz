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
import { Cli } from '@kitz/cli'
import { Err } from '@kitz/core'
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Cause, Console, Effect, FileSystem, Layer, Option, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, ServicesLayer, FileSystemLayer } from '../../platform.js'
import { loadConfiguredPullRequestDiff, resolveDiffRemote } from '../pr-preview-diff.js'
import {
  formatIgnoredInvalidPlanMessage,
  formatInvalidPlanMessage,
  formatMissingPlanMessage,
  loadActivePlan,
  loadPlan,
} from './plan-file.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'
import { computeLifecyclePlanAttempt, toUnavailableLifecycleReport } from './doctor-lib.js'
import { runDoctorReportForPlan } from './doctor-runtime.js'

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
    Schema.UndefinedOr(Schema.Literals(['official', 'candidate', 'ephemeral'])).pipe(
      Schema.annotate({ description: 'Only evaluate a single release lifecycle' }),
    ),
  )
  .parameter(
    'all a',
    Schema.UndefinedOr(Schema.Boolean)
      .pipe(
        Schema.decodeTo(Schema.Boolean, {
          decode: SchemaGetter.transform((value) => value ?? false),
          encode: SchemaGetter.transform((value) => value),
        }),
      )
      .pipe(
        Schema.annotate({
          description: 'Force all lifecycles, including ephemeral without detected PR context',
          default: false,
        }),
      ),
  )
  .parameter(
    'only-rule',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'Only run matching rules (comma-separated patterns)' }),
    ),
  )
  .parameter(
    'skip-rule',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'Skip matching rules (comma-separated patterns)' }),
    ),
  )
  .parameter(
    'format f',
    Schema.UndefinedOr(Schema.Literals(['text', 'json'])).pipe(
      Schema.annotate({ description: 'Output format (text or json)' }),
    ),
  )
  .parameter(
    'remote r',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({
        description:
          'Remote to use for env.git-remote validation and PR diff-aware checks (default: configured env.git-remote or origin)',
      }),
    ),
  )
  .parameter(
    'from',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotate({ description: 'Read the release plan from a specific file path' }),
    ),
  )
  .parse()

const spawnerLayer = ChildProcessSpawnerLayer

Cli.run(
  Layer.mergeAll(
    Env.Live,
    ServicesLayer,
    FileSystemLayer,
    spawnerLayer,
    Api.Lint.Preconditions.DefaultLayer,
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

    if (args.from && (args.lifecycle || args.all)) {
      yield* Console.error('Choose either --from or --lifecycle/--all, not both.')
      return yield* Effect.fail({ _tag: 'DoctorFailures' })
    }

    const workspace = yield* loadCommandWorkspace({
      lint: {
        onlyRules: parseCsvStrings(args.onlyRule),
        skipRules: parseCsvStrings(args.skipRule),
      },
    })
    if (!isReadyCommandWorkspace(workspace)) {
      yield* Console.log(noPackagesFoundMessage)
      return
    }
    const { config, packages } = workspace

    const activePlanState = args.from
      ? yield* loadPlan({
          path: Fs.Path.fromString(args.from),
          source: 'custom',
        })
      : args.lifecycle || args.all
        ? null
        : yield* loadActivePlan()
    if (activePlanState?._tag === 'PlanMissing') {
      for (const line of formatMissingPlanMessage(activePlanState)) {
        yield* Console.error(line)
      }
      return yield* Effect.fail({ _tag: 'DoctorFailures' })
    }
    if (activePlanState?._tag === 'PlanInvalid') {
      const lines =
        activePlanState.source === 'custom'
          ? formatInvalidPlanMessage(activePlanState)
          : formatIgnoredInvalidPlanMessage(activePlanState)
      for (const line of lines) {
        yield* Console.error(line)
      }
      if (activePlanState.source === 'custom') {
        return yield* Effect.fail({ _tag: 'DoctorFailures' })
      }
    }
    const activePlan =
      activePlanState?._tag === 'PlanLoaded' ? Option.some(activePlanState.plan) : Option.none()
    const needsSmartScope = !args.lifecycle && !args.all && Option.isNone(activePlan)
    const needsPrContext =
      needsSmartScope ||
      args.all ||
      args.lifecycle === 'ephemeral' ||
      (Option.isSome(activePlan) && activePlan.value.lifecycle === 'ephemeral')
    const pullRequestAttempt = needsPrContext
      ? yield* Api.Explorer.resolvePullRequest().pipe(Effect.result)
      : { _tag: 'Success' as const, success: null }
    const pullRequest = pullRequestAttempt._tag === 'Success' ? pullRequestAttempt.success : null
    const hasPrContext = pullRequest !== null
    const scope = Api.Doctor.resolveScope({
      ...(args.lifecycle ? { lifecycle: args.lifecycle } : {}),
      ...(args.all ? { all: true } : {}),
      ...(Option.isSome(activePlan) ? { activePlan: activePlan.value } : {}),
      hasPrContext,
    })

    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({
      packages,
      tags,
      resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
    })
    const currentBranch = yield* git.getCurrentBranch()
    const diffRemote = resolveDiffRemote(config, args.remote)
    const diff = pullRequest
      ? yield* loadConfiguredPullRequestDiff({
          config,
          pullRequest,
          packages,
          required: false,
          ...(args.remote ? { remote: args.remote } : {}),
        })
      : null
    const reports: Api.Doctor.LifecycleReport[] = []
    const doctorRuntimeContext = {
      config,
      analysis,
      packages,
      currentBranch,
      pullRequest,
      diff,
      diffRemote,
    } satisfies Parameters<typeof runDoctorReportForPlan>[0]
    const evaluatePlan = (plan: Api.Planner.Plan, required: boolean) =>
      Effect.gen(function* () {
        const report = yield* runDoctorReportForPlan(doctorRuntimeContext, plan)

        reports.push({
          _tag: 'CheckedLifecycleReport' as const,
          lifecycle: plan.lifecycle,
          required,
          plannedPackages: plan.releases.length + plan.cascades.length,
          report,
        })
      })
    if (scope._tag === 'ActivePlanScope') {
      yield* evaluatePlan(scope.plan, true)
    } else {
      for (const target of scope.lifecycles) {
        const planAttempt = yield* computeLifecyclePlanAttempt(analysis, packages, target.lifecycle)

        if (planAttempt._tag === 'Failure') {
          reports.push(
            toUnavailableLifecycleReport(target.lifecycle, target.required, planAttempt.failure),
          )
          continue
        }

        yield* evaluatePlan(planAttempt.success, target.required)
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
      yield* Console.log(Api.Doctor.formatEvaluation(evaluation, { env: env.vars }))
    }

    if (Api.Doctor.hasBlockingIssues(evaluation)) {
      return yield* Effect.fail({ _tag: 'DoctorFailures' })
    }
  }),
)
