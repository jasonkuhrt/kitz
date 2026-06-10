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
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Console, Effect, Layer, Option } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import * as Analyzer from '../../api/analyzer/__.js'
import * as Doctor from '../../api/doctor.js'
import * as Explorer from '../../api/explorer/__.js'
import * as Lint from '../../api/lint/__.js'
import * as Planner from '../../api/planner/__.js'
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

const parseCsvStrings = (value: string | undefined): readonly string[] | undefined => {
  if (value === undefined) return undefined

  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  return parts.length > 0 ? parts : undefined
}

const spawnerLayer = ChildProcessSpawnerLayer

const DoctorCommandLayer = Layer.mergeAll(
  Env.Live,
  ServicesLayer,
  FileSystemLayer,
  spawnerLayer,
  Lint.Preconditions.DefaultLayer,
  Lint.ReleasePlan.DefaultReleasePlanLayer,
  Git.GitLive,
)

export const doctor = Command.make(
  'doctor',
  {
    lifecycle: Flag.choice('lifecycle', ['official', 'candidate', 'ephemeral']).pipe(
      Flag.withAlias('l'),
      Flag.withDescription('Only evaluate a single release lifecycle'),
      Flag.optional,
    ),
    all: Flag.boolean('all').pipe(
      Flag.withAlias('a'),
      Flag.withDescription('Force all lifecycles, including ephemeral without detected PR context'),
      Flag.withDefault(false),
    ),
    onlyRule: Flag.string('only-rule').pipe(
      Flag.withDescription('Only run matching rules (comma-separated patterns)'),
      Flag.optional,
    ),
    skipRule: Flag.string('skip-rule').pipe(
      Flag.withDescription('Skip matching rules (comma-separated patterns)'),
      Flag.optional,
    ),
    format: Flag.choice('format', ['text', 'json']).pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Output format (text or json)'),
      Flag.optional,
    ),
    remote: Flag.string('remote').pipe(
      Flag.withAlias('r'),
      Flag.withDescription(
        'Remote to use for env.git-remote validation and PR diff-aware checks (default: configured env.git-remote or origin)',
      ),
      Flag.optional,
    ),
    from: Flag.string('from').pipe(
      Flag.withDescription('Read the release plan from a specific file path'),
      Flag.optional,
    ),
  },
  (flags) =>
    Effect.gen(function* () {
      const args = {
        lifecycle: Option.getOrUndefined(flags.lifecycle),
        all: flags.all,
        onlyRule: Option.getOrUndefined(flags.onlyRule),
        skipRule: Option.getOrUndefined(flags.skipRule),
        format: Option.getOrUndefined(flags.format),
        remote: Option.getOrUndefined(flags.remote),
        from: Option.getOrUndefined(flags.from),
      }

      const env = yield* Env.Env
      const git = yield* Git.Git

      if (args.lifecycle && args.all) {
        yield* Console.error('Choose either --lifecycle or --all, not both.')
        return env.exit(1)
      }

      if (args.from && (args.lifecycle || args.all)) {
        yield* Console.error('Choose either --from or --lifecycle/--all, not both.')
        return env.exit(1)
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
        return env.exit(1)
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
          return env.exit(1)
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
        ? yield* Explorer.resolvePullRequest().pipe(Effect.result)
        : { _tag: 'Success' as const, success: null }
      const pullRequest = pullRequestAttempt._tag === 'Success' ? pullRequestAttempt.success : null
      const hasPrContext = pullRequest !== null
      const scope = Doctor.resolveScope({
        ...(args.lifecycle ? { lifecycle: args.lifecycle } : {}),
        ...(args.all ? { all: true } : {}),
        ...(Option.isSome(activePlan) ? { activePlan: activePlan.value } : {}),
        hasPrContext,
      })

      const tags = yield* git.getTags()
      const analysis = yield* Analyzer.analyze({
        packages,
        tags,
        resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
        commitOverrides: config.commitOverrides,
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
      const reports: Doctor.LifecycleReport[] = []
      const doctorRuntimeContext = {
        config,
        analysis,
        packages,
        currentBranch,
        pullRequest,
        diff,
        diffRemote,
      } satisfies Parameters<typeof runDoctorReportForPlan>[0]
      const evaluatePlan = (plan: Planner.Plan, required: boolean) =>
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
          const planAttempt = yield* computeLifecyclePlanAttempt(
            analysis,
            packages,
            target.lifecycle,
          )

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
      } satisfies Doctor.DoctorEvaluation

      if (args.format === 'json') {
        yield* Console.log(JSON.stringify(evaluation, null, 2))
      } else {
        yield* Console.log(Doctor.formatEvaluation(evaluation, { env: env.vars }))
      }

      if (Doctor.hasBlockingIssues(evaluation)) {
        return env.exit(1)
      }
    }),
).pipe(
  Command.withDescription(
    'Run doctor checks (default: active plan if present, otherwise official and candidate; add ephemeral when PR context exists)',
  ),
  Command.provide(DoctorCommandLayer),
)
