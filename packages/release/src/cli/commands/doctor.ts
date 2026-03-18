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
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Cause, Console, Effect, FileSystem, Layer, Option, Schema, SchemaGetter } from 'effect'
import * as Api from '../../api/__.js'
import { ChildProcessSpawnerLayer, ServicesLayer, FileSystemLayer } from '../../platform.js'
import {
  commandLintRule,
  createCommandLintConfig,
  type CommandLintRuleSpec,
} from '../lint-rule-config.js'
import { loadConfiguredPullRequestDiff, resolveDiffRemote } from '../pr-preview-diff.js'
import {
  isReadyCommandWorkspace,
  loadCommandWorkspace,
  noPackagesFoundMessage,
} from './command-workspace.js'
import { computeLifecyclePlanAttempt, toUnavailableLifecycleReport } from './doctor-lib.js'

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

    const activePlan = yield* Api.Planner.Store.readActive
    const needsSmartScope = !args.lifecycle && !args.all && activePlan._tag !== 'Some'
    const needsPrContext =
      needsSmartScope ||
      args.all ||
      args.lifecycle === 'ephemeral' ||
      (activePlan._tag === 'Some' && activePlan.value.lifecycle === 'ephemeral')
    const pullRequestAttempt = needsPrContext
      ? yield* Api.Explorer.resolvePullRequest().pipe(Effect.result)
      : { _tag: 'Success' as const, success: null }
    const pullRequest = pullRequestAttempt._tag === 'Success' ? pullRequestAttempt.success : null
    const hasPrContext = pullRequest !== null
    const scope = Api.Doctor.resolveScope({
      ...(args.lifecycle ? { lifecycle: args.lifecycle } : {}),
      ...(args.all ? { all: true } : {}),
      ...(activePlan._tag === 'Some' ? { activePlan: activePlan.value } : {}),
      hasPrContext,
    })

    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({ packages, tags })
    const currentBranch = yield* git.getCurrentBranch()
    const diffRemote = resolveDiffRemote(config)
    const diff = pullRequest
      ? yield* loadConfiguredPullRequestDiff({
          config,
          pullRequest,
          packages,
          required: false,
        })
      : null
    const monorepo = {
      packages: packages.map((pkg) => ({
        name: pkg.name.moniker,
        path: pkg.path.toString(),
      })),
      validScopes: packages.map((pkg) => pkg.scope),
    }
    const prContext = pullRequest ? yield* Api.Lint.fromPullRequest(pullRequest) : null
    const lintPrContext = prContext ?? {
      number: 0,
      title: '',
      body: '',
      commit: Option.none(),
      titleParseError: Option.none(),
    }
    const hasDiff = diff !== null && diff.files.length > 0
    const diffLayer = diff ? Layer.succeed(Api.Lint.DiffService, diff) : Api.Lint.DefaultDiffLayer

    const reports: Api.Doctor.LifecycleReport[] = []
    const evaluatePlan = (plan: Api.Planner.Plan, required: boolean) =>
      Effect.gen(function* () {
        const plannedItems = [...plan.releases, ...plan.cascades]
        const channel = Api.Publishing.resolvePublishChannel(config.publishing, plan.lifecycle)
        const projectedSquashCommit =
          pullRequest && plan.releases.length > 0
            ? Api.ProjectedSquashCommit.preview({
                actualTitle: pullRequest.title,
                impacts: Api.ProjectedSquashCommit.collectScopeImpacts(analysis, {
                  scopes: plan.releases.map((item) => item.package.scope),
                }),
              })
            : undefined
        const doctorRules = [
          commandLintRule({
            id: 'env.publish-channel-ready',
            options: {
              surface: 'execution',
            },
          }),
          commandLintRule({
            id: 'env.git-clean',
          }),
          commandLintRule({
            id: 'env.git-remote',
            options: {
              remote: diffRemote,
            },
          }),
          commandLintRule({
            id: 'plan.tags-unique',
          }),
          commandLintRule({
            id: 'plan.versions-unpublished',
          }),
          ...(channel.mode !== 'github-trusted'
            ? [
                commandLintRule({
                  id: 'env.npm-authenticated',
                }),
              ]
            : []),
          ...(projectedSquashCommit?.projectedHeader
            ? [
                commandLintRule({
                  id: 'pr.projected-squash-commit-sync',
                  options: {
                    projectedHeader: projectedSquashCommit.projectedHeader,
                  },
                  enabled: 'auto',
                  severity: Api.Lint.Warn.make({}),
                  preserveExistingOverrides: true,
                }),
              ]
            : []),
          ...(pullRequest && hasDiff
            ? [
                commandLintRule({
                  id: 'pr.type.release-kind-match-diff',
                }),
              ]
            : []),
        ] satisfies readonly CommandLintRuleSpec[]

        const lintConfig = createCommandLintConfig({
          config,
          rules: doctorRules,
        })
        const baseReportEffect = Api.Lint.check({ config: lintConfig }).pipe(
          Effect.provide(
            Layer.mergeAll(
              diffLayer,
              Api.Lint.DefaultGitHubLayer,
              Api.Lint.Preconditions.make({
                hasOpenPR: pullRequest !== null,
                hasDiff,
                hasReleasePlan: true,
                isMonorepo: packages.length > 1,
              }),
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
          Effect.provideService(Api.Lint.MonorepoService, monorepo),
          Effect.provideService(Api.Lint.PrService, lintPrContext),
        )
        const report = yield* baseReportEffect

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
      yield* Console.log(Api.Doctor.formatEvaluation(evaluation))
    }

    if (Api.Doctor.hasBlockingIssues(evaluation)) {
      return yield* Effect.fail({ _tag: 'DoctorFailures' })
    }
  }),
)
