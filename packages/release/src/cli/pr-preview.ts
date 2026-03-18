import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Data, Effect, Layer } from 'effect'
import * as Api from '../api/__.js'
import {
  commandLintRule,
  createCommandLintConfig,
  type CommandLintRuleSpec,
} from './lint-rule-config.js'
import { loadConfiguredPullRequestDiff } from './pr-preview-diff.js'

const manualPreviewDeferredRules = [
  Api.Lint.Rules.EnvNpmAuthenticated,
  Api.Lint.Rules.EnvGitClean,
  Api.Lint.Rules.EnvGitRemote,
] as const

const appendReleaseCommand = (releaseCommand: string, suffix: string): string =>
  `${releaseCommand} ${suffix}`

const hasBlockingViolations = (report: Api.Lint.Report): boolean =>
  report.results.some(
    (result) =>
      Api.Lint.Finished.is(result) &&
      result.violation !== undefined &&
      Api.Lint.Severity.guards.SeverityError(result.severity),
  )

const toMonorepo = (packages: readonly Api.Analyzer.Workspace.Package[]) => ({
  packages: packages.map((pkg) => ({
    name: pkg.name.moniker,
    path: pkg.path.toString(),
  })),
  validScopes: packages.map((pkg) => pkg.scope),
})

export class PreviewBlockingError extends Data.TaggedError('PreviewBlockingError')<{
  readonly issueNumber: number
  readonly commentId?: number
  readonly commentUrl?: string
  readonly body?: string
}> {}

export interface RunPrPreviewOptions {
  readonly checkOnly?: boolean
}

export interface PreviewCommentUpdateParams {
  readonly issueNumber: number
  readonly forecast: Api.Forecaster.Forecast
  readonly doctor?: Api.Commentator.DoctorSummary
  readonly projectedSquashCommit?: Api.ProjectedSquashCommit.Preview
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

const hasBlockingPreviewIssues = (doctor?: Api.Commentator.DoctorSummary): boolean =>
  doctor?.rows.some((row) => row.status === 'error') ?? false

export const renderPreviewComment = (
  params: PreviewCommentUpdateParams & {
    readonly existingCommentBody?: string | null
  },
): string =>
  Api.Commentator.render(params.forecast, {
    publishState: 'idle',
    publishHistory: params.existingCommentBody
      ? Api.Commentator.parsePublishHistory(params.existingCommentBody)
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
      Api.Commentator.PLAN_MARKER,
    )

    const body = renderPreviewComment({
      ...params,
      existingCommentBody: existing?.body ?? null,
    })

    const issueComment = yield* github.upsertIssueComment({
      issueNumber: params.issueNumber,
      marker: Api.Commentator.PLAN_MARKER,
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

export const buildPreviewDoctorSummary = (params: {
  readonly config: Api.Config.ResolvedConfig
  readonly analysis: Api.Analyzer.Models.Analysis
  readonly packages: readonly Api.Analyzer.Workspace.Package[]
  readonly pullRequest: Github.PullRequest
  readonly projectedSquashCommit?: Api.ProjectedSquashCommit.Preview
  readonly diff: Api.Lint.Diff
  readonly blockingTitleChecks: boolean
}) =>
  Effect.gen(function* () {
    const planAttempt = yield* Api.Planner.ephemeral(params.analysis, {
      packages: params.packages,
    }).pipe(Effect.result)

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
        } satisfies Api.Commentator.DoctorSummary,
        blocking: false,
      }
    }

    const plan = planAttempt.success
    const plannedItems = [...plan.releases, ...plan.cascades]
    if (plannedItems.length === 0) {
      return {
        blocking: false,
      }
    }

    const publish = Api.Publishing.resolvePublishSemanticsForPlan({
      plan,
      publishing: params.config.publishing,
      npmTag: params.config.npmTag,
      candidateTag: params.config.candidateTag,
    })
    const titleSeverity = params.blockingTitleChecks
      ? Api.Lint.Error.make({})
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

    const report = yield* Api.Lint.check({ config: lintConfig }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(Api.Lint.DiffService, params.diff),
          Api.Lint.DefaultGitHubLayer,
          Api.Lint.Preconditions.make({
            hasOpenPR: true,
            hasDiff: params.diff.files.length > 0,
            hasReleasePlan: true,
            isMonorepo: params.packages.length > 1,
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
            publishing: params.config.publishing,
          }),
        ),
      ),
      Effect.provideService(Api.Lint.MonorepoService, toMonorepo(params.packages)),
      Effect.provideService(
        Api.Lint.PrService,
        yield* Api.Lint.fromPullRequest(params.pullRequest),
      ),
    )

    return {
      summary: Api.Commentator.createDoctorSummary(report, {
        lifecycle: plan.lifecycle,
        plannedPackages: plannedItems.length,
        ...(publish.channel.mode === 'manual' && plan.lifecycle === 'ephemeral'
          ? {
              runbook: {
                title: 'Manual Preview Runbook',
                commands: [
                  ...params.config.operator.prepareCommands,
                  `PR_NUMBER=${String(plan.releases.find(Api.Planner.Ephemeral.is)?.prerelease.prNumber ?? params.pullRequest.number)} ${appendReleaseCommand(params.config.operator.releaseCommand, 'plan --lifecycle ephemeral')}`,
                  appendReleaseCommand(params.config.operator.releaseCommand, 'doctor'),
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
                          `doctor --onlyRule ${rule.data.id}`,
                        ),
                      },
                    ]
                  : [],
              ),
            }
          : {}),
      }),
      blocking: hasBlockingViolations(report),
    }
  })

export const runPrPreview = (options: RunPrPreviewOptions = {}) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const config = yield* Api.Config.load()
    const packages = yield* Api.Analyzer.Workspace.resolvePackages(config.packages)

    if (packages.length === 0) {
      return yield* Effect.fail(
        new Api.Explorer.ExplorerError({
          context: {
            detail:
              'No packages found. Check release.config.ts `packages` field or ensure the workspace root declares packages.',
          },
        }),
      )
    }

    const pullRequestContext = yield* Api.Explorer.resolvePullRequestContext()
    const runtime = yield* Api.Explorer.exploreFromContext(pullRequestContext)
    const pullRequest = pullRequestContext.pullRequest
    if (!pullRequest) {
      return yield* Effect.fail(
        new Api.Explorer.ExplorerError({
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

    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({ packages, tags })
    const projectedSquashCommit = Api.ProjectedSquashCommit.preview({
      actualTitle: pullRequest.title,
      impacts: Api.ProjectedSquashCommit.collectScopeImpacts(analysis),
    })
    const diff = yield* loadConfiguredPullRequestDiff({
      config,
      pullRequest,
      packages,
      required: true,
    })

    const doctor = yield* buildPreviewDoctorSummary({
      config,
      analysis,
      packages,
      pullRequest,
      ...(projectedSquashCommit ? { projectedSquashCommit } : {}),
      diff: diff ?? { files: [], affectedPackages: [] },
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

    const forecast = Api.Forecaster.forecast(analysis, runtime)
    const preview = yield* upsertPullRequestPreviewComment({
      issueNumber: pullRequest.number,
      forecast,
      ...(doctor.summary ? { doctor: doctor.summary } : {}),
      ...(projectedSquashCommit ? { projectedSquashCommit } : {}),
      interactiveChecklist:
        (config.publishing.ephemeral ?? { mode: 'manual' as const }).mode !== 'manual',
    }).pipe(
      Effect.provide(
        Github.LiveFetch({
          owner: pullRequestContext.target.owner,
          repo: pullRequestContext.target.repo,
          token,
        }),
      ),
    )

    return {
      _tag: 'updated',
      ...preview,
    } satisfies RunPrPreviewResult
  })
