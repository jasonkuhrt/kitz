/**
 * @module cli/commands/pr-lib
 *
 * Decision logic behind the `release pr` command tree: the PR preview
 * pipeline (forecast + doctor summary + comment upsert) and the canonical
 * PR title preparation.
 *
 * Pipeline seams are expressed as Effect services ({@link PreviewDoctor},
 * {@link PrPreview}) with live layers; tests provide stub layers instead of
 * hand-rolled dependency records.
 */
import { ConventionalCommits } from '@kitz/conventional-commits'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Console, Data, Effect, Layer, Context, Result } from 'effect'
import * as Analyzer from '../../api/analyzer/__.js'
import * as Commentator from '../../api/commentator/__.js'
import * as Config from '../../api/config.js'
import * as Explorer from '../../api/explorer/__.js'
import * as Forecaster from '../../api/forecaster/__.js'
import * as Lint from '../../api/lint/__.js'
import * as Planner from '../../api/planner/__.js'
import * as ProjectedSquashCommit from '../../api/projected-squash-commit.js'
import * as Publishing from '../../api/publishing.js'
import {
  commandLintRule,
  createCommandLintConfig,
  type CommandLintRuleSpec,
} from '../lint-rule-config.js'
import { provideLintRunEnv } from '../lint-run-env.js'
import { addOfficialPlanCascades } from './forecast-lib.js'
import { noPackagesFoundMessage } from './command-workspace.js'
import { loadPullRequestDiff, resolveDiffRemote } from './pr-lib-diff.js'

const manualPreviewDeferredRules = [
  Lint.Rules.EnvNpmAuthenticated,
  Lint.Rules.EnvGitClean,
  Lint.Rules.EnvGitRemote,
] as const

const appendReleaseCommand = (releaseCommand: string, suffix: string): string =>
  `${releaseCommand} ${suffix}`

const hasBlockingViolations = (report: Lint.Report): boolean =>
  report.results.some(
    (result) =>
      Lint.Finished.is(result) && result.violation !== undefined && result.severity === 'error',
  )

export class PreviewBlockingError extends Data.TaggedError('PreviewBlockingError')<{
  readonly issueNumber: number
  readonly commentId?: number
  readonly commentUrl?: string
  readonly body?: string
}> {}

export interface RunPrPreviewOptions {
  readonly checkOnly?: boolean
  readonly remote?: string
}

export interface PreviewCommentUpdateParams {
  readonly issueNumber: number
  readonly forecast: Forecaster.Forecast
  readonly doctor?: Commentator.DoctorSummary
  readonly projectedSquashCommit?: ProjectedSquashCommit.Preview
  readonly interactiveChecklist: boolean
}

export interface PreviewCommentUpdateResult {
  readonly body: string
  readonly issueComment: {
    readonly id: number
    readonly body: string | null
    readonly html_url: string
  }
}

export type RunPrPreviewResult =
  | { readonly _tag: 'checked'; readonly issueNumber: number }
  | ({ readonly _tag: 'updated' } & PreviewCommentUpdateResult)

export interface BuildPreviewDoctorSummaryParams {
  readonly config: Config.ResolvedConfig
  readonly analysis: Analyzer.Models.Analysis
  readonly packages: readonly Analyzer.Workspace.Package[]
  readonly pullRequest: Github.PullRequest
  readonly projectedSquashCommit?: ProjectedSquashCommit.Preview
  readonly diff: Lint.Diff
  readonly diffRemote?: string
  readonly blockingTitleChecks: boolean
}

export interface BuildPreviewDoctorSummaryResult {
  readonly summary?: Commentator.DoctorSummary
  readonly blocking: boolean
}

export interface PreviewLintCheckParams {
  readonly lintConfig: Lint.ResolvedConfig
  readonly config: Config.ResolvedConfig
  readonly diff: Lint.Diff
  readonly packages: readonly Analyzer.Workspace.Package[]
  readonly pullRequest: Github.PullRequest
  readonly plan: Planner.PlanOf<'ephemeral'>
}

// ─── PreviewDoctor service ───────────────────────────────────────────

export interface PreviewDoctorShape {
  readonly planEphemeral: (
    analysis: Analyzer.Models.Analysis,
    ctx: { readonly packages: readonly Analyzer.Workspace.Package[] },
  ) => Effect.Effect<Planner.PlanOf<'ephemeral'>, Error>
  readonly runLintCheck: (params: PreviewLintCheckParams) => Effect.Effect<Lint.Report, Error>
}

/**
 * Seams of the preview doctor summary: ephemeral planning and the lint run.
 * {@link PreviewDoctorLive} wires the real planner and lint stack; tests
 * provide stubs via `Layer.succeed(PreviewDoctor)(...)`.
 */
export class PreviewDoctor extends Context.Service<PreviewDoctor, PreviewDoctorShape>()(
  '@kitz/release/cli/PreviewDoctor',
) {}

/** The live lint run for the preview doctor summary (exported for tests that exercise real lint wiring). */
export const runPreviewLintCheck = (params: PreviewLintCheckParams) =>
  Lint.check({ config: params.lintConfig }).pipe(
    provideLintRunEnv({
      config: params.config,
      plan: params.plan,
      packages: params.packages,
      diff: params.diff,
      pullRequest: params.pullRequest,
    }),
  )

type PreviewDoctorRequirements =
  | Effect.Services<ReturnType<typeof Planner.ephemeral>>
  | Effect.Services<ReturnType<typeof runPreviewLintCheck>>

/** Build the live {@link PreviewDoctor} implementation, capturing required services. */
export const makePreviewDoctor: Effect.Effect<
  PreviewDoctorShape,
  never,
  PreviewDoctorRequirements
> = Effect.gen(function* () {
  const services = yield* Effect.context<PreviewDoctorRequirements>()
  return {
    planEphemeral: (analysis, ctx) =>
      Effect.provideContext(Planner.ephemeral(analysis, ctx), services),
    runLintCheck: (params) => Effect.provideContext(runPreviewLintCheck(params), services),
  }
})

export const PreviewDoctorLive = Layer.effect(PreviewDoctor, makePreviewDoctor)

// ─── Preview rendering & comment upsert ──────────────────────────────

const hasBlockingPreviewIssues = (doctor?: Commentator.DoctorSummary): boolean =>
  doctor?.rows.some((row) => row.status === 'error') ?? false

export const renderPreviewComment = (
  params: PreviewCommentUpdateParams & {
    readonly existingCommentBody?: string | null
  },
): string =>
  Commentator.render(params.forecast, {
    publishState: 'idle',
    publishHistory: params.existingCommentBody
      ? Commentator.parsePublishHistory(params.existingCommentBody)
      : [],
    interactiveChecklist: params.interactiveChecklist,
    ...(params.doctor ? { doctor: params.doctor } : {}),
    ...(params.projectedSquashCommit
      ? { projectedSquashCommit: params.projectedSquashCommit }
      : {}),
  })

export const upsertPullRequestPreviewComment = (params: PreviewCommentUpdateParams) =>
  Effect.gen(function* () {
    const github = yield* Github.Github
    const existing = yield* github.findIssueCommentByMarker(
      params.issueNumber,
      Commentator.PLAN_MARKER,
    )

    const body = renderPreviewComment({
      ...params,
      existingCommentBody: existing?.body ?? null,
    })

    const issueComment = yield* github.upsertIssueComment({
      issueNumber: params.issueNumber,
      marker: Commentator.PLAN_MARKER,
      body,
      existingComment: existing,
    })

    const blocking = hasBlockingPreviewIssues(params.doctor)
    if (blocking) {
      return yield* Effect.fail(
        new PreviewBlockingError({
          issueNumber: params.issueNumber,
          body,
          commentId: issueComment.id,
          commentUrl: issueComment.html_url,
        }),
      )
    }

    return {
      body,
      issueComment,
    } satisfies PreviewCommentUpdateResult
  })

// ─── Doctor summary ──────────────────────────────────────────────────

export const buildPreviewDoctorSummary = (
  params: BuildPreviewDoctorSummaryParams,
): Effect.Effect<BuildPreviewDoctorSummaryResult, Error, PreviewDoctor> =>
  Effect.gen(function* () {
    const previewDoctor = yield* PreviewDoctor
    const diffRemote = params.diffRemote ?? resolveDiffRemote(params.config)
    const planAttempt = yield* previewDoctor
      .planEphemeral(params.analysis, { packages: params.packages })
      .pipe(Effect.result)

    if (planAttempt._tag === 'Failure') {
      return {
        summary: {
          lifecycle: 'ephemeral',
          rows: [
            {
              label: 'Ephemeral plan',
              status: 'warn',
              notes: planAttempt.failure.message,
            },
          ],
          guidance: [],
          deferredChecks: [],
        } satisfies Commentator.DoctorSummary,
        blocking: false,
      }
    }

    const plan = planAttempt.success
    const plannedItems = [...plan.releases, ...plan.cascades]
    if (plannedItems.length === 0) {
      return { blocking: false }
    }

    const publish = Publishing.resolvePublishSemanticsForPlan({
      plan,
      publishing: params.config.publishing,
      npmTag: params.config.npmTag,
      candidateTag: params.config.candidateTag,
    })
    const titleSeverity = params.blockingTitleChecks
      ? 'error'
      : params.config.lint.defaults.severity
    const commentDoctorRules = [
      commandLintRule({
        id: 'env.publish-channel-ready',
        options: {
          surface: 'preview',
        },
      }),
      commandLintRule({
        id: 'plan.packages-not-private',
      }),
      commandLintRule({
        id: 'plan.packages-license-present',
      }),
      commandLintRule({
        id: 'plan.packages-repository-present',
      }),
      commandLintRule({
        id: 'plan.packages-repository-match-canonical',
      }),
      commandLintRule({
        id: 'plan.versions-unpublished',
      }),
      commandLintRule({
        id: 'plan.tags-unique',
      }),
      commandLintRule({
        id: 'pr.type.release-kind-match-diff',
        severity: titleSeverity,
      }),
      ...(params.projectedSquashCommit?.projectedHeader
        ? [
            commandLintRule({
              id: 'pr.projected-squash-commit-sync',
              options: {
                projectedHeader: params.projectedSquashCommit.projectedHeader,
              },
              severity: titleSeverity,
            }),
          ]
        : []),
    ] satisfies readonly CommandLintRuleSpec[]
    const lintConfig = createCommandLintConfig({
      config: params.config,
      rules: commentDoctorRules,
      onlyRules: commentDoctorRules.map((rule) => rule.id),
      skipRules: [],
    })

    const report = yield* previewDoctor.runLintCheck({
      lintConfig,
      config: params.config,
      diff: params.diff,
      packages: params.packages,
      pullRequest: params.pullRequest,
      plan,
    })

    const summary = Commentator.createDoctorSummary(report, {
      lifecycle: plan.lifecycle,
      plannedPackages: plannedItems.length,
      ...(publish.channel.mode === 'manual' && plan.lifecycle === 'ephemeral'
        ? {
            runbook: {
              title: 'Manual Preview Runbook',
              commands: [
                ...params.config.operator.prepareCommands,
                `PR_NUMBER=${String(plan.releases.find(Planner.Ephemeral.is)?.prerelease.prNumber ?? params.pullRequest.number)} ${appendReleaseCommand(params.config.operator.releaseCommand, 'plan --lifecycle ephemeral')}`,
                appendReleaseCommand(
                  params.config.operator.releaseCommand,
                  renderDoctorCommandSuffix(diffRemote),
                ),
                appendReleaseCommand(params.config.operator.releaseCommand, 'apply --yes'),
              ],
              note:
                'Step 2 writes the exact ephemeral publish plan to `.release/plan.json`. ' +
                `Step 4 publishes those packages to the \`${publish.distTag}\` dist-tag automatically.`,
            },
            deferredChecks: manualPreviewDeferredRules.flatMap((rule) =>
              rule.data.preventsDescriptions && rule.data.preventsDescriptions.length > 0
                ? [
                    {
                      label: rule.data.description,
                      ruleId: rule.data.id,
                      preventsDescriptions: rule.data.preventsDescriptions,
                      checkCommand: appendReleaseCommand(
                        params.config.operator.releaseCommand,
                        renderDoctorCommandSuffix(diffRemote, [`--onlyRule ${rule.data.id}`]),
                      ),
                    },
                  ]
                : [],
            ),
          }
        : {}),
    })

    return {
      ...(summary ? { summary } : {}),
      blocking: hasBlockingViolations(report),
    }
  })

// ─── PrPreview service ───────────────────────────────────────────────

export interface PreviewCommentTransport {
  readonly owner: string
  readonly repo: string
  readonly token: string
}

/**
 * Seams of the PR preview pipeline. {@link PrPreviewLive} wires real
 * implementations; tests provide stub layers.
 */
export class PrPreview extends Context.Service<
  PrPreview,
  {
    readonly loadConfig: Effect.Effect<Config.ResolvedConfig, Error>
    readonly resolvePackages: (
      packages: Config.ResolvedConfig['packages'],
    ) => Effect.Effect<readonly Analyzer.Workspace.Package[], Error>
    readonly resolvePullRequestContext: Effect.Effect<Explorer.ResolvedPullRequestContext, Error>
    readonly exploreFromContext: (
      context: Explorer.ResolvedGitHubContext,
    ) => Effect.Effect<Explorer.Recon, Error>
    readonly getTags: Effect.Effect<readonly string[], Error>
    readonly analyze: (
      params: Parameters<typeof Analyzer.analyze>[0],
    ) => Effect.Effect<Analyzer.Models.Analysis, Error>
    readonly loadPullRequestDiff: (
      params: Parameters<typeof loadPullRequestDiff>[0],
    ) => Effect.Effect<Lint.Diff | null, Error>
    readonly buildDoctorSummary: (
      params: BuildPreviewDoctorSummaryParams,
    ) => Effect.Effect<BuildPreviewDoctorSummaryResult, Error>
    readonly forecast: (params: {
      readonly analysis: Analyzer.Models.Analysis
      readonly packages: readonly Analyzer.Workspace.Package[]
      readonly recon: Explorer.Recon
    }) => Effect.Effect<Forecaster.Forecast, Error>
    readonly upsertPreviewComment: (
      params: PreviewCommentUpdateParams,
      transport: PreviewCommentTransport,
    ) => Effect.Effect<PreviewCommentUpdateResult, Error>
  }
>()('@kitz/release/cli/PrPreview') {}

/**
 * The live preview forecast: official-plan cascades folded into the analysis,
 * then the pure forecaster. Exported for tests exercising the real path.
 */
export const buildPreviewForecast = (params: {
  readonly analysis: Analyzer.Models.Analysis
  readonly packages: readonly Analyzer.Workspace.Package[]
  readonly recon: Explorer.Recon
}) =>
  addOfficialPlanCascades(params.analysis, params.packages).pipe(
    Effect.flatMap(
      (analysis): Effect.Effect<Forecaster.Forecast, Error> =>
        Forecaster.hasGithubTarget(params.recon)
          ? Result.match(Forecaster.forecast(analysis, params.recon), {
              onFailure: Effect.fail,
              onSuccess: Effect.succeed,
            })
          : Effect.fail(
              new Explorer.ExplorerError({
                context: {
                  detail: 'no GitHub repository target was resolved from the git remote',
                },
              }),
            ),
    ),
  )

type PrPreviewRequirements =
  | Effect.Services<ReturnType<typeof Config.load>>
  | Effect.Services<ReturnType<typeof Analyzer.Workspace.resolvePackages>>
  | Effect.Services<ReturnType<typeof Explorer.resolvePullRequestContext>>
  | Effect.Services<ReturnType<typeof Explorer.exploreFromContext>>
  | Effect.Services<ReturnType<typeof Analyzer.analyze>>
  | Effect.Services<ReturnType<typeof loadPullRequestDiff>>
  | Effect.Services<ReturnType<typeof buildPreviewForecast>>
  | PreviewDoctorRequirements
  | Git.Git

export const PrPreviewLive = Layer.effect(
  PrPreview,
  Effect.gen(function* () {
    const services = yield* Effect.context<PrPreviewRequirements>()
    const previewDoctor = yield* makePreviewDoctor

    return {
      loadConfig: Effect.provideContext(Config.load(), services),
      resolvePackages: (packages) =>
        Effect.provideContext(Analyzer.Workspace.resolvePackages(packages), services),
      resolvePullRequestContext: Effect.provideContext(
        Explorer.resolvePullRequestContext(),
        services,
      ),
      exploreFromContext: (context) =>
        Effect.provideContext(Explorer.exploreFromContext(context), services),
      getTags: Effect.provideContext(
        Effect.gen(function* () {
          const git = yield* Git.Git
          return yield* git.getTags()
        }),
        services,
      ),
      analyze: (params) => Effect.provideContext(Analyzer.analyze(params), services),
      loadPullRequestDiff: (params) => Effect.provideContext(loadPullRequestDiff(params), services),
      buildDoctorSummary: (params) =>
        buildPreviewDoctorSummary(params).pipe(Effect.provideService(PreviewDoctor, previewDoctor)),
      forecast: (params) => Effect.provideContext(buildPreviewForecast(params), services),
      upsertPreviewComment: (params, transport) =>
        upsertPullRequestPreviewComment(params).pipe(
          Effect.provide(
            Github.LiveFetch({
              owner: transport.owner,
              repo: transport.repo,
              token: transport.token,
            }),
          ),
        ),
    }
  }),
)

// ─── Preview pipeline ────────────────────────────────────────────────

export const runPrPreview = (
  options: RunPrPreviewOptions = {},
): Effect.Effect<RunPrPreviewResult, Error, PrPreview> =>
  Effect.gen(function* () {
    const preview = yield* PrPreview
    const config = yield* preview.loadConfig
    const packages = yield* preview.resolvePackages(config.packages)

    if (packages.length === 0) {
      return yield* Effect.fail(
        new Explorer.ExplorerError({
          context: {
            detail: noPackagesFoundMessage,
          },
        }),
      )
    }

    const pullRequestContext = yield* preview.resolvePullRequestContext
    const runtime = yield* preview.exploreFromContext(pullRequestContext)
    const pullRequest = pullRequestContext.pullRequest
    if (!pullRequest) {
      return yield* Effect.fail(
        new Explorer.ExplorerError({
          context: {
            detail:
              'Could not resolve an open pull request for the current branch. Set PR_NUMBER explicitly or open a PR first.',
          },
        }),
      )
    }

    const token = pullRequestContext.token
    if (!token || token.trim() === '') {
      return yield* Effect.fail(
        new Github.GithubConfigError({
          context: {
            detail: 'GITHUB_TOKEN is required to evaluate or maintain the release PR preview.',
          },
        }),
      )
    }

    const tags = yield* preview.getTags
    const diffRemote = resolveDiffRemote(config, options.remote)
    const analysis = yield* preview.analyze({
      packages,
      tags,
      since: `${diffRemote}/${pullRequest.base.ref}`,
      resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
      commitOverrides: config.commitOverrides,
    })
    const projectedSquashCommit = ProjectedSquashCommit.preview({
      actualTitle: pullRequest.title,
      impacts: ProjectedSquashCommit.collectScopeImpacts(analysis, { primaryOnly: true }),
    })
    const diff = yield* preview.loadPullRequestDiff({
      pullRequest,
      packages,
      required: true,
      remote: diffRemote,
    })

    const doctor = yield* preview.buildDoctorSummary({
      config,
      analysis,
      packages,
      pullRequest,
      ...(projectedSquashCommit ? { projectedSquashCommit } : {}),
      diff: diff ?? { files: [], affectedPackages: [] },
      ...(diffRemote !== 'origin' ? { diffRemote } : {}),
      blockingTitleChecks: true,
    })

    if (options.checkOnly) {
      if (doctor.blocking) {
        return yield* Effect.fail(
          new PreviewBlockingError({
            issueNumber: pullRequest.number,
          }),
        )
      }

      return {
        _tag: 'checked',
        issueNumber: pullRequest.number,
      } satisfies RunPrPreviewResult
    }

    const forecast = yield* preview.forecast({ analysis, packages, recon: runtime })
    const result = yield* preview.upsertPreviewComment(
      {
        issueNumber: pullRequest.number,
        forecast,
        ...(doctor.summary ? { doctor: doctor.summary } : {}),
        ...(projectedSquashCommit ? { projectedSquashCommit } : {}),
        interactiveChecklist:
          (config.publishing.ephemeral ?? { mode: 'manual' as const }).mode !== 'manual',
      },
      {
        owner: pullRequestContext.target.owner,
        repo: pullRequestContext.target.repo,
        token,
      },
    )

    return {
      _tag: 'updated',
      ...result,
    } satisfies RunPrPreviewResult
  })

const renderDoctorCommandSuffix = (
  diffRemote: string | undefined,
  extraArgs: readonly string[] = [],
): string => {
  const args = ['doctor']
  if (diffRemote && diffRemote !== 'origin') {
    args.push(`--remote ${diffRemote}`)
  }
  args.push(...extraArgs)
  return args.join(' ')
}

// ─── PR title preparation ────────────────────────────────────────────

/**
 * Resolve the canonical release header and a suggested rewrite for the
 * connected PR's title. Returns `null` (after printing the canonical
 * message) when no workspace packages were found.
 */
export const preparePrTitle = Effect.gen(function* () {
  const git = yield* Git.Git
  const config = yield* Config.load()
  const packages = yield* Analyzer.Workspace.resolvePackages(config.packages)

  if (packages.length === 0) {
    yield* Console.log(noPackagesFoundMessage)
    return null
  }

  const pullRequestContext = yield* Explorer.resolvePullRequestContext()
  const pullRequest = pullRequestContext.pullRequest
  if (!pullRequest) {
    return yield* Effect.fail(
      new Explorer.ExplorerError({
        context: {
          detail:
            'Could not resolve an open pull request for the current branch. Set PR_NUMBER explicitly or open a PR first.',
        },
      }),
    )
  }

  const tags = yield* git.getTags()
  const remote = resolveDiffRemote(config)
  const analysis = yield* Analyzer.analyze({
    packages,
    tags,
    since: `${remote}/${pullRequest.base.ref}`,
    resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
    commitOverrides: config.commitOverrides,
  })
  const projectedHeader = ProjectedSquashCommit.renderHeader({
    impacts: ProjectedSquashCommit.collectScopeImpacts(analysis, { primaryOnly: true }),
  })

  if (!projectedHeader) {
    return yield* Effect.fail(
      new Explorer.ExplorerError({
        context: {
          detail: 'No primary release impacts were found, so no canonical PR title header exists.',
        },
      }),
    )
  }

  const rewriteAttempt = yield* ConventionalCommits.Title.rewriteHeader(
    pullRequest.title,
    projectedHeader,
  ).pipe(Effect.result)

  return {
    githubContext: pullRequestContext,
    pullRequest,
    projectedHeader,
    suggestedTitle: rewriteAttempt._tag === 'Success' ? rewriteAttempt.success : null,
    titleRewriteError: rewriteAttempt._tag === 'Failure' ? rewriteAttempt.failure.message : null,
  }
})
