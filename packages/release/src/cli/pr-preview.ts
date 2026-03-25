import { ChildProcess, ChildProcessSpawner } from 'effect/unstable/process'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Data, Effect, HashSet, Layer, MutableHashSet } from 'effect'
import * as Api from '../api/__.js'

const previewDoctorRuleIds = [
  'env.publish-channel-ready',
  'plan.packages-not-private',
  'plan.packages-license-present',
  'plan.packages-repository-present',
  'plan.packages-repository-match-canonical',
  'plan.versions-unpublished',
  'plan.tags-unique',
] as const

const manualPreviewDeferredRules = [
  Api.Lint.Rules.EnvNpmAuthenticated,
  Api.Lint.Rules.EnvGitClean,
  Api.Lint.Rules.EnvGitRemote,
] as const

const appendReleaseCommand = (releaseCommand: string, suffix: string): string =>
  `${releaseCommand} ${suffix}`

const enableRule = (
  config: Api.Config.ResolvedConfig,
  ruleId: string,
  ruleOptions: Record<string, unknown> = {},
  options?: { readonly severity?: Api.Lint.Severity },
) => {
  const existing = config.lint.rules[ruleId]
  return Api.Lint.RuleConfig.make({
    overrides: Api.Lint.RuleDefaults.make({
      enabled: true,
      severity: options?.severity ?? existing?.overrides.severity ?? config.lint.defaults.severity,
    }),
    options: {
      ...existing?.options,
      ...ruleOptions,
    },
  })
}

const parseDiffStatus = (token: string): Api.Lint.ChangedFile['status'] => {
  switch (token[0]) {
    case 'A':
      return 'added'
    case 'D':
      return 'deleted'
    case 'R':
      return 'renamed'
    default:
      return 'modified'
  }
}

const parseDiffLine = (line: string): Api.Lint.ChangedFile | null => {
  const parts = line.split('\t')
  const statusToken = parts[0]?.trim()
  if (!statusToken) return null

  const path =
    statusToken.startsWith('R') || statusToken.startsWith('C')
      ? (parts[2]?.trim() ?? parts[1]?.trim())
      : parts[1]?.trim()

  if (!path) return null

  return {
    path,
    status: parseDiffStatus(statusToken),
  }
}

const toAffectedPackages = (
  files: readonly Api.Lint.ChangedFile[],
  packages: readonly Api.Analyzer.Workspace.Package[],
): readonly string[] => {
  const scopes = HashSet.fromIterable(packages.map((pkg) => pkg.scope))
  const affected = MutableHashSet.empty<string>()

  for (const file of files) {
    const [root, scope] = file.path.split('/')
    if (root === 'packages' && scope && HashSet.has(scopes, scope)) {
      MutableHashSet.add(affected, scope)
    }
  }

  return Array.from(affected).toSorted((left, right) => left.localeCompare(right))
}

const hasBlockingViolations = (report: Api.Lint.Report): boolean =>
  report.results.some(
    (result) =>
      Api.Lint.Finished.is(result) &&
      result.violation !== undefined &&
      Api.Lint.Error.is(result.severity),
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

interface PreviewDoctorLintParams {
  readonly config: Api.Lint.ResolvedConfig
  readonly diff: Api.Lint.Diff
  readonly packages: readonly Api.Analyzer.Workspace.Package[]
  readonly pullRequest: Github.PullRequest
  readonly plannedItems: ReadonlyArray<{
    readonly package: Api.Analyzer.Workspace.Package
    readonly nextVersion: unknown
  }>
  readonly lifecycle: Api.Commentator.DoctorSummary['lifecycle']
  readonly publishing: Api.Config.ResolvedConfig['publishing']
}

export interface BuildPreviewDoctorSummaryDependencies {
  readonly planEphemeral?: typeof Api.Planner.ephemeral
  readonly runLintCheck?: (params: PreviewDoctorLintParams) => Effect.Effect<Api.Lint.Report, Error>
}

interface PreviewCommentTransportParams extends PreviewCommentUpdateParams {
  readonly runtime: {
    readonly owner: string
    readonly repo: string
    readonly token: string
  }
}

export interface RunPrPreviewDependencies {
  readonly loadConfig?: typeof Api.Config.load
  readonly resolvePackages?: typeof Api.Analyzer.Workspace.resolvePackages
  readonly exploreRuntime?: typeof Api.Explorer.explore
  readonly resolvePullRequest?: typeof Api.Explorer.resolvePullRequest
  readonly getTags?: (git: Git.GitService) => Effect.Effect<readonly string[], Error>
  readonly analyze?: typeof Api.Analyzer.analyze
  readonly loadPullRequestDiff?: typeof loadPullRequestDiff
  readonly buildPreviewDoctorSummary?: typeof buildPreviewDoctorSummary
  readonly forecast?: typeof Api.Forecaster.forecast
  readonly updatePreviewComment?: (
    params: PreviewCommentTransportParams,
  ) => Effect.Effect<PreviewCommentUpdateResult, Error>
}

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

export const loadPullRequestDiff = (params: {
  readonly pullRequest: Github.PullRequest
  readonly packages: readonly Api.Analyzer.Workspace.Package[]
  readonly required: boolean
}) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const root = yield* git.getRoot()
    const baseRef = params.pullRequest.base.ref.trim()

    if (baseRef.length === 0) {
      return params.required
        ? yield* Effect.fail(
            new Api.Explorer.ExplorerError({
              context: {
                detail:
                  'Connected pull request is missing a base ref, so release preview cannot compute the PR diff.',
              },
            }),
          )
        : null
    }

    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const command = ChildProcess.make(
      'git',
      ['diff', '--name-status', `origin/${baseRef}...HEAD`],
      {
        cwd: root,
      },
    )
    const output = yield* spawner.string(command).pipe(
      Effect.result,
      Effect.flatMap((result) => {
        if (result._tag === 'Success') return Effect.succeed(result.success)

        if (!params.required) {
          return Effect.logWarning(
            `Skipping diff-aware release checks because git diff against origin/${baseRef} could not be computed: ${result.failure instanceof Error ? result.failure.message : JSON.stringify(result.failure)}`,
          ).pipe(Effect.as(''))
        }

        return Effect.fail(
          new Api.Explorer.ExplorerError({
            context: {
              detail:
                `Could not compute git diff against origin/${baseRef}. ` +
                'Fetch the pull-request base branch before running release preview or doctor.',
            },
          }),
        )
      }),
    )

    const files = output
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map(parseDiffLine)
      .filter((entry: any): entry is Api.Lint.ChangedFile => entry !== null)

    return {
      files,
      affectedPackages: toAffectedPackages(files, params.packages),
    }
  })

const runPreviewDoctorLintLive = (params: PreviewDoctorLintParams) =>
  Api.Lint.fromPullRequest(params.pullRequest).pipe(
    Effect.flatMap((pullRequest) =>
      Api.Lint.check({ config: params.config }).pipe(
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
              params.plannedItems.map((item) => ({
                packageName: item.package.name,
                packagePath: item.package.path,
                version: item.nextVersion,
              })),
            ),
            Api.Lint.ReleaseContext.make({
              lifecycle: params.lifecycle,
              publishing: params.publishing,
            }),
          ),
        ),
        Effect.provideService(Api.Lint.MonorepoService, toMonorepo(params.packages)),
        Effect.provideService(Api.Lint.PrService, pullRequest),
      ),
    ),
    Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error)))),
  )

export const buildPreviewDoctorSummary = (
  params: {
    readonly config: Api.Config.ResolvedConfig
    readonly analysis: Api.Analyzer.Models.Analysis
    readonly packages: readonly Api.Analyzer.Workspace.Package[]
    readonly pullRequest: Github.PullRequest
    readonly projectedSquashCommit?: Api.ProjectedSquashCommit.Preview
    readonly diff: Api.Lint.Diff
    readonly blockingTitleChecks: boolean
  },
  dependencies: BuildPreviewDoctorSummaryDependencies = {},
) =>
  Effect.gen(function* () {
    const planAttempt = yield* (dependencies.planEphemeral ?? Api.Planner.ephemeral)(
      params.analysis,
      {
        packages: params.packages,
      },
    ).pipe(Effect.result)

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

    const channel = Api.Publishing.resolvePublishChannel(params.config.publishing, plan.lifecycle)
    const commentDoctorRules = [
      ...previewDoctorRuleIds,
      'pr.type.release-kind-match-diff',
      ...(params.projectedSquashCommit?.projectedHeader
        ? (['pr.projected-squash-commit-sync'] as const)
        : []),
    ]

    const titleSeverity = params.blockingTitleChecks
      ? Api.Lint.Error.make({})
      : params.config.lint.defaults.severity
    const lintConfig = Api.Lint.resolveConfig({
      defaults: Api.Lint.RuleDefaults.make({
        enabled: params.config.lint.defaults.enabled,
        severity: params.config.lint.defaults.severity,
      }),
      rules: {
        ...params.config.lint.rules,
        'env.publish-channel-ready': enableRule(params.config, 'env.publish-channel-ready', {
          surface: 'preview',
        }),
        'plan.packages-not-private': enableRule(params.config, 'plan.packages-not-private'),
        'plan.packages-license-present': enableRule(params.config, 'plan.packages-license-present'),
        'plan.packages-repository-present': enableRule(
          params.config,
          'plan.packages-repository-present',
        ),
        'plan.packages-repository-match-canonical': enableRule(
          params.config,
          'plan.packages-repository-match-canonical',
        ),
        'plan.versions-unpublished': enableRule(params.config, 'plan.versions-unpublished'),
        'plan.tags-unique': enableRule(params.config, 'plan.tags-unique'),
        'pr.type.release-kind-match-diff': enableRule(
          params.config,
          'pr.type.release-kind-match-diff',
          {},
          {
            severity: titleSeverity,
          },
        ),
        ...(params.projectedSquashCommit?.projectedHeader
          ? {
              'pr.projected-squash-commit-sync': enableRule(
                params.config,
                'pr.projected-squash-commit-sync',
                {
                  projectedHeader: params.projectedSquashCommit.projectedHeader,
                },
                {
                  severity: titleSeverity,
                },
              ),
            }
          : {}),
      },
      onlyRules: [...commentDoctorRules],
    })

    const report = yield* (dependencies.runLintCheck ?? runPreviewDoctorLintLive)({
      config: lintConfig,
      diff: params.diff,
      packages: params.packages,
      pullRequest: params.pullRequest,
      plannedItems,
      lifecycle: plan.lifecycle,
      publishing: params.config.publishing,
    })

    return {
      summary: Api.Commentator.createDoctorSummary(report, {
        lifecycle: plan.lifecycle,
        plannedPackages: plannedItems.length,
        ...(channel.mode === 'manual' && plan.lifecycle === 'ephemeral'
          ? {
              runbook: {
                title: 'Manual Preview Runbook',
                commands: [
                  ...params.config.operator.prepareCommands,
                  `PR_NUMBER=${String(plan.releases.find(Api.Planner.Ephemeral.is)?.prerelease.prNumber ?? params.pullRequest.number)} ${appendReleaseCommand(params.config.operator.releaseCommand, 'plan --lifecycle ephemeral')}`,
                  appendReleaseCommand(params.config.operator.releaseCommand, 'doctor'),
                  appendReleaseCommand(
                    params.config.operator.releaseCommand,
                    'apply --yes --tag pr',
                  ),
                ],
                note:
                  'Step 2 writes the exact ephemeral publish plan to `.release/plan.json`. ' +
                  'Step 4 publishes those packages to the `pr` dist-tag.',
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

const updatePreviewCommentLive = (params: PreviewCommentTransportParams) =>
  upsertPullRequestPreviewComment({
    issueNumber: params.issueNumber,
    forecast: params.forecast,
    ...(params.doctor ? { doctor: params.doctor } : {}),
    ...(params.projectedSquashCommit
      ? { projectedSquashCommit: params.projectedSquashCommit }
      : {}),
    interactiveChecklist: params.interactiveChecklist,
  }).pipe(
    Effect.provide(
      Github.LiveFetch({
        owner: params.runtime.owner,
        repo: params.runtime.repo,
        token: params.runtime.token,
      }),
    ),
  )

export const runPrPreview = (
  options: RunPrPreviewOptions = {},
  dependencies: RunPrPreviewDependencies = {},
) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const config = yield* (dependencies.loadConfig ?? Api.Config.load)()
    const packages = yield* (
      dependencies.resolvePackages ?? Api.Analyzer.Workspace.resolvePackages
    )(config.packages)

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

    const runtime = yield* (dependencies.exploreRuntime ?? Api.Explorer.explore)()
    if (!runtime.github.target) {
      return yield* Effect.fail(
        new Api.Explorer.ExplorerError({
          context: {
            detail:
              'Could not resolve the GitHub repository target for the connected pull request.',
          },
        }),
      )
    }
    const pullRequest = yield* (
      dependencies.resolvePullRequest ?? Api.Explorer.resolvePullRequest
    )()
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

    const token = runtime.github.credentials?.token
    if (!token || token.trim() === '') {
      return yield* Effect.fail(
        new Github.GithubConfigError({
          context: {
            detail: 'GITHUB_TOKEN is required to evaluate or maintain the release PR preview.',
          },
        }),
      )
    }

    const tags = yield* dependencies.getTags?.(git) ?? git.getTags()
    const analysis = yield* (dependencies.analyze ?? Api.Analyzer.analyze)({ packages, tags })
    const projectedSquashCommit = Api.ProjectedSquashCommit.preview({
      actualTitle: pullRequest.title,
      impacts: Api.ProjectedSquashCommit.collectScopeImpacts(analysis),
    })
    const diff = yield* (dependencies.loadPullRequestDiff ?? loadPullRequestDiff)({
      pullRequest,
      packages,
      required: true,
    })

    const doctor = yield* (dependencies.buildPreviewDoctorSummary ?? buildPreviewDoctorSummary)({
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

    const forecast = (dependencies.forecast ?? Api.Forecaster.forecast)(analysis, runtime)
    const preview = yield* (dependencies.updatePreviewComment ?? updatePreviewCommentLive)({
      issueNumber: pullRequest.number,
      forecast,
      ...(doctor.summary ? { doctor: doctor.summary } : {}),
      ...(projectedSquashCommit ? { projectedSquashCommit } : {}),
      interactiveChecklist:
        (config.publishing.ephemeral ?? { mode: 'manual' as const }).mode !== 'manual',
      runtime: {
        owner: runtime.github.target.owner,
        repo: runtime.github.target.repo,
        token,
      },
    })

    return {
      _tag: 'updated',
      ...preview,
    } satisfies RunPrPreviewResult
  })
