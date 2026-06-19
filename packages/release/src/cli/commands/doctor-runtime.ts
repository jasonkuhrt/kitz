import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Effect, Layer, Option } from 'effect'
import * as Api from '../../api/__.js'
import {
  commandLintRule,
  createCommandLintConfig,
  type CommandLintRuleSpec,
} from '../lint-rule-config.js'

export interface DoctorPlanRuntimeContext {
  readonly config: Api.Config.ResolvedConfig
  readonly analysis: Api.Analyzer.Models.Analysis
  readonly packages: readonly Api.Analyzer.Workspace.Package[]
  readonly currentBranch: string
  readonly pullRequest: Github.PullRequest | null
  readonly diff: Api.Lint.Diff | null
  readonly diffRemote: string
}

const toMonorepo = (packages: readonly Api.Analyzer.Workspace.Package[]) => ({
  packages: packages.map((pkg) => ({
    name: pkg.name.moniker,
    path: pkg.path.toString(),
  })),
  validScopes: packages.map((pkg) => pkg.scope),
})

const emptyPrContext = {
  number: 0,
  title: '',
  body: '',
  commit: Option.none(),
  titleParseError: Option.none(),
} as const

export const runDoctorReportForPlan = (context: DoctorPlanRuntimeContext, plan: Api.Planner.Plan) =>
  Effect.gen(function* () {
    const plannedItems = [...plan.releases, ...plan.cascades]
    const channel = Api.Publishing.resolvePublishChannel(context.config.publishing, plan.lifecycle)
    const projectedSquashCommit =
      context.pullRequest && plan.releases.length > 0
        ? Api.ProjectedSquashCommit.preview({
            actualTitle: context.pullRequest.title,
            impacts: Api.ProjectedSquashCommit.collectScopeImpacts(context.analysis, {
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
          remote: context.diffRemote,
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
      ...(context.pullRequest && context.diff && context.diff.files.length > 0
        ? [
            commandLintRule({
              id: 'pr.type.release-kind-match-diff',
            }),
          ]
        : []),
    ] satisfies readonly CommandLintRuleSpec[]

    const lintConfig = createCommandLintConfig({
      config: context.config,
      rules: doctorRules,
    })
    const diffLayer = context.diff
      ? Layer.succeed(Api.Lint.DiffService, context.diff)
      : Api.Lint.DefaultDiffLayer
    const hasDiff = context.diff !== null && context.diff.files.length > 0
    const prContext = context.pullRequest
      ? yield* Api.Lint.fromPullRequest(context.pullRequest)
      : emptyPrContext

    return yield* Api.Lint.check({ config: lintConfig }).pipe(
      Effect.provide(
        Layer.mergeAll(
          diffLayer,
          Api.Lint.DefaultGitHubLayer,
          Api.Lint.Preconditions.make({
            hasOpenPR: context.pullRequest !== null,
            hasDiff,
            hasReleasePlan: true,
            isMonorepo: context.packages.length > 1,
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
            publishing: context.config.publishing,
            trunk: context.config.trunk,
            currentBranch: context.currentBranch,
          }),
          Api.Lint.ConventionalCommitSettings.make({
            resolvedTypes: context.config.resolvedConventionalCommitTypes,
          }),
        ),
      ),
      Effect.provideService(Api.Lint.MonorepoService, toMonorepo(context.packages)),
      Effect.provideService(Api.Lint.PrService, prContext),
    )
  })

export const createDoctorSummaryForPlan = (
  plan: Api.Planner.Plan,
  report: Api.Lint.Report,
): Api.Commentator.DoctorSummary | undefined =>
  Api.Commentator.createDoctorSummary(report, {
    lifecycle: plan.lifecycle,
    plannedPackages: plan.releases.length + plan.cascades.length,
  })
