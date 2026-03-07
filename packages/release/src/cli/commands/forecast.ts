/**
 * @module cli/commands/forecast
 *
 * Render a read-only release forecast from the current repo or a saved forecast file.
 *
 * Forecasts are lifecycle-agnostic: they always project official versions for human review.
 * Output formats support scan-heavy CLI viewing (`table`, `tree`), PR comment rendering
 * (`comment`), and machine exchange (`json`).
 */
import { FileSystem } from '@effect/platform'
import { NodeContext, NodeFileSystem } from '@effect/platform-node'
import { Cli } from '@kitz/cli'
import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Oak } from '@kitz/oak'
import { Console, Effect, Either, Layer, Option, Schema } from 'effect'
import * as Api from '../../api/__.js'

const args = Oak.Command.create()
  .use(Oak.EffectSchema)
  .description('Render a release forecast')
  .parameter(
    'format f',
    Schema.transform(
      Schema.UndefinedOr(Schema.Literal('table', 'tree', 'comment', 'json')),
      Schema.Literal('table', 'tree', 'comment', 'json'),
      {
        strict: true,
        decode: (value) => value ?? 'table',
        encode: (value) => value,
      },
    ).pipe(Schema.annotations({ description: 'Output format', default: 'table' })),
  )
  .parameter(
    'from-file',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({
        description: 'Read saved forecast JSON from a file instead of computing from the repo',
      }),
    ),
  )
  .parameter(
    'publish-history',
    Schema.UndefinedOr(Schema.String).pipe(
      Schema.annotations({
        description: 'Path to JSON file containing prior publish history for comment/json output',
      }),
    ),
  )
  .parse()

Cli.run(Layer.mergeAll(Env.Live, NodeContext.layer, NodeFileSystem.layer, Git.GitLive))(
  Effect.gen(function* () {
    const input = yield* args.fromFile
      ? loadForecastInputFromFile(args.fromFile)
      : buildForecastInput({
          publishHistoryPath: args.publishHistory,
          includeDoctor: args.format === 'comment',
        })

    const rendered =
      args.format === 'table'
        ? Api.Renderer.renderTable(input.forecast)
        : args.format === 'tree'
          ? Api.Renderer.renderTree(input.forecast)
          : args.format === 'comment'
            ? Api.Commentator.render(input.forecast, {
                publishState: input.publishState,
                publishHistory: input.publishHistory,
                interactiveChecklist: input.interactiveChecklist,
                ...(input.projectedSquashCommit
                  ? { projectedSquashCommit: input.projectedSquashCommit }
                  : {}),
                ...(input.doctor ? { doctor: input.doctor } : {}),
              })
            : Api.Forecaster.encodeForecastEnvelope({
                forecast: input.forecast,
                publishState: input.publishState,
                publishHistory: input.publishHistory,
              })

    yield* Console.log(rendered)
  }),
)

interface ForecastInput {
  readonly forecast: Api.Forecaster.Forecast
  readonly publishState: Api.Commentator.PublishState
  readonly publishHistory: readonly Api.Commentator.PublishRecord[]
  readonly doctor?: Api.Commentator.DoctorSummary
  readonly projectedSquashCommit?: Api.ProjectedSquashCommit.Preview
  readonly interactiveChecklist: boolean
}

const commentDoctorRuleIds = [
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

const buildForecastInput = (options: {
  readonly publishHistoryPath: string | undefined
  readonly includeDoctor: boolean
}) =>
  Effect.gen(function* () {
    const git = yield* Git.Git
    const config = yield* Api.Config.load()
    const packages = yield* Api.Analyzer.Workspace.resolvePackages(config.packages)

    if (packages.length === 0) {
      yield* Console.log(
        'No packages found. Check release.config.ts `packages` field ' +
          'or ensure the root package.json defines workspace packages.',
      )
      return {
        forecast: Api.Forecaster.Forecast.make({
          owner: '',
          repo: '',
          branch: '',
          headSha: '',
          releases: [],
          cascades: [],
        }),
        publishState: 'idle' as const,
        publishHistory: [],
        doctor: undefined,
        interactiveChecklist: false,
      }
    }

    const tags = yield* git.getTags()
    const analysis = yield* Api.Analyzer.analyze({ packages, tags })
    const recon = yield* Api.Explorer.explore()
    const forecast = Api.Forecaster.forecast(analysis, recon)
    const pullRequest = yield* Api.Explorer.resolvePullRequest().pipe(
      Effect.catchTag('ExplorerError', () => Effect.succeed(null)),
      Effect.catchTag('GithubAuthError', () => Effect.succeed(null)),
      Effect.catchTag('GithubError', () => Effect.succeed(null)),
      Effect.catchTag('GithubNotFoundError', () => Effect.succeed(null)),
      Effect.catchTag('GithubRateLimitError', () => Effect.succeed(null)),
    )
    const projectedSquashCommit = pullRequest
      ? Api.ProjectedSquashCommit.preview({
          actualTitle: pullRequest.title,
          impacts: Api.ProjectedSquashCommit.collectScopeImpacts(analysis),
        })
      : undefined

    return {
      forecast,
      publishState: 'idle' as const,
      publishHistory: yield* readPublishHistory(options.publishHistoryPath),
      interactiveChecklist: config.publishing.ephemeral.mode !== 'manual',
      ...(projectedSquashCommit ? { projectedSquashCommit } : {}),
      doctor: options.includeDoctor
        ? yield* buildCommentDoctor({
            config,
            analysis,
            packages,
            pullRequest,
            ...(projectedSquashCommit ? { projectedSquashCommit } : {}),
          })
        : undefined,
    }
  })

const loadForecastInputFromFile = (filePath: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const jsonText = yield* fs.readFileString(filePath)
    const envelope = yield* Schema.decodeUnknown(Api.Forecaster.ForecastEnvelopeJson)(
      jsonText,
    ).pipe(Effect.option)

    if (Option.isSome(envelope)) {
      return {
        forecast: envelope.value.forecast,
        publishState: envelope.value.publishState,
        publishHistory: envelope.value.publishHistory,
        doctor: undefined,
        projectedSquashCommit: undefined,
        interactiveChecklist: false,
      }
    }

    return {
      forecast: yield* Schema.decodeUnknown(Schema.parseJson(Api.Forecaster.Forecast))(jsonText),
      publishState: 'idle' as const,
      publishHistory: [],
      doctor: undefined,
      projectedSquashCommit: undefined,
      interactiveChecklist: false,
    }
  })

const readPublishHistory = (filePath: string | undefined) =>
  Effect.gen(function* () {
    if (!filePath) return []

    const fs = yield* FileSystem.FileSystem
    const parsed = yield* fs
      .readFileString(filePath)
      .pipe(
        Effect.option,
        Effect.map(Option.flatMap(Schema.decodeUnknownOption(Api.Commentator.PublishHistoryJson))),
      )

    return parsed.pipe(
      Option.map((value) => value.publishes),
      Option.getOrElse((): readonly Api.Commentator.PublishRecord[] => []),
    )
  })

const enableRule = (
  config: Api.Config.ResolvedConfig,
  ruleId: string,
  ruleOptions: Record<string, unknown> = {},
) => {
  const existing = config.lint.rules[ruleId]
  return Api.Lint.RuleConfig.make({
    overrides: Api.Lint.RuleDefaults.make({
      enabled: true,
      ...(existing ? { severity: existing.overrides.severity } : {}),
    }),
    options: {
      ...(existing ? existing.options : {}),
      ...ruleOptions,
    },
  })
}

const buildCommentDoctor = (params: {
  readonly config: Api.Config.ResolvedConfig
  readonly analysis: Api.Analyzer.Models.Analysis
  readonly packages: readonly Api.Analyzer.Workspace.Package[]
  readonly pullRequest: {
    readonly number: number
    readonly title: string
    readonly body: string | null
  } | null
  readonly projectedSquashCommit?: Api.ProjectedSquashCommit.Preview
}) =>
  Effect.gen(function* () {
    const planAttempt = yield* Api.Planner.ephemeral(params.analysis, {
      packages: params.packages,
    }).pipe(Effect.either)

    if (Either.isLeft(planAttempt)) {
      return {
        lifecycle: 'ephemeral' as const,
        rows: [
          {
            label: 'Ephemeral plan',
            status: 'warn' as const,
            notes: planAttempt.left.message,
          },
        ],
        guidance: [],
        deferredChecks: [],
      } satisfies Api.Commentator.DoctorSummary
    }

    const plan = planAttempt.right
    const plannedItems = [...plan.releases, ...plan.cascades]
    if (plannedItems.length === 0) return undefined
    const channel = Api.Publishing.resolvePublishChannel(params.config.publishing, plan.lifecycle)
    const ephemeralPrNumber =
      plan.lifecycle === 'ephemeral'
        ? plannedItems.find(Api.Planner.Ephemeral.is)?.prerelease.prNumber
        : undefined
    const commentDoctorRules = [
      ...commentDoctorRuleIds,
      ...(params.pullRequest && params.projectedSquashCommit?.projectedHeader
        ? (['pr.projected-squash-commit-sync'] as const)
        : []),
    ]

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
        ...(params.pullRequest && params.projectedSquashCommit?.projectedHeader
          ? {
              'pr.projected-squash-commit-sync': enableRule(
                params.config,
                'pr.projected-squash-commit-sync',
                {
                  projectedHeader: params.projectedSquashCommit.projectedHeader,
                },
              ),
            }
          : {}),
      },
      onlyRules: [...commentDoctorRules],
    })

    const monorepo = {
      packages: params.packages.map((pkg) => ({
        name: pkg.name.moniker,
        path: pkg.path.toString(),
      })),
      validScopes: params.packages.map((pkg) => pkg.scope),
    }
    const prContext = params.pullRequest
      ? yield* Api.Lint.fromPullRequest(params.pullRequest)
      : null
    const lintPrContext = prContext ?? {
      number: 0,
      title: '',
      body: '',
      commit: Option.none(),
      titleParseError: Option.none(),
    }
    const baseReportEffect = Api.Lint.check({ config: lintConfig }).pipe(
      Effect.provide(
        Layer.mergeAll(
          Api.Lint.DefaultDiffLayer,
          Api.Lint.DefaultGitHubLayer,
          Api.Lint.Preconditions.make({
            hasOpenPR: params.pullRequest !== null,
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
      Effect.provideService(Api.Lint.MonorepoService, monorepo),
      Effect.provideService(Api.Lint.PrService, lintPrContext),
    )
    const report = yield* baseReportEffect.pipe(Effect.either)

    if (Either.isLeft(report)) {
      return {
        lifecycle: plan.lifecycle,
        rows: [
          {
            label: 'Doctor',
            status: 'warn' as const,
            notes: report.left.message ?? 'Comment doctor could not be evaluated.',
          },
        ],
        guidance: [],
        deferredChecks: [],
      } satisfies Api.Commentator.DoctorSummary
    }

    return Api.Commentator.createDoctorSummary(report.right, {
      lifecycle: plan.lifecycle,
      plannedPackages: plannedItems.length,
      ...(channel.mode === 'manual' && plan.lifecycle === 'ephemeral'
        ? {
            runbook: {
              title: 'Manual Preview Runbook',
              commands: [
                'bun run release:build',
                `PR_NUMBER=${String(ephemeralPrNumber ?? '<pr-number>')} bun run release:plan:ephemeral`,
                'bun run release doctor',
                'bun run release:apply:ephemeral',
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
                      checkCommand: `bun run release doctor --onlyRule ${rule.data.id}`,
                    },
                  ]
                : [],
            ),
          }
        : {}),
    })
  })
