import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Effect, Layer, Option } from 'effect'
import * as Analyzer from '../../api/analyzer/__.js'
import * as Commentator from '../../api/commentator/__.js'
import * as Config from '../../api/config.js'
import * as Lint from '../../api/lint/__.js'
import * as Planner from '../../api/planner/__.js'
import * as ProjectedSquashCommit from '../../api/projected-squash-commit.js'
import * as Publishing from '../../api/publishing.js'
import {
  commandLintRule,
  createCommandLintConfig,
  type CommandLintRuleSpec,
} from '../lint-rule-config.js'

export interface DoctorPlanRuntimeContext {
  readonly config: Config.ResolvedConfig
  readonly analysis: Analyzer.Models.Analysis
  readonly packages: readonly Analyzer.Workspace.Package[]
  readonly currentBranch: string
  readonly pullRequest: Github.PullRequest | null
  readonly diff: Lint.Diff | null
  readonly diffRemote: string
}

const toMonorepo = (packages: readonly Analyzer.Workspace.Package[]) => ({
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

export const runDoctorReportForPlan = (context: DoctorPlanRuntimeContext, plan: Planner.Plan) =>
  Effect.gen(function* () {
    const plannedItems = [...plan.releases, ...plan.cascades]
    const channel = Publishing.resolvePublishChannel(context.config.publishing, plan.lifecycle)
    const projectedSquashCommit =
      context.pullRequest && plan.releases.length > 0
        ? ProjectedSquashCommit.preview({
            actualTitle: context.pullRequest.title,
            impacts: ProjectedSquashCommit.collectScopeImpacts(context.analysis, {
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
              severity: Lint.Warn.make({}),
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
      ? Layer.succeed(Lint.DiffService, context.diff)
      : Lint.DefaultDiffLayer
    const hasDiff = context.diff !== null && context.diff.files.length > 0
    const prContext = context.pullRequest
      ? yield* Lint.fromPullRequest(context.pullRequest)
      : emptyPrContext

    return yield* Lint.check({ config: lintConfig }).pipe(
      Effect.provide(
        Layer.mergeAll(
          diffLayer,
          Lint.DefaultGitHubLayer,
          Lint.Preconditions.make({
            hasOpenPR: context.pullRequest !== null,
            hasDiff,
            hasReleasePlan: true,
            isMonorepo: context.packages.length > 1,
          }),
          Lint.ReleasePlan.make(
            plannedItems.map((item) => ({
              packageName: item.package.name,
              packagePath: item.package.path,
              version: item.nextVersion,
            })),
          ),
          Lint.ReleaseContext.make({
            lifecycle: plan.lifecycle,
            publishing: context.config.publishing,
            trunk: context.config.trunk,
            currentBranch: context.currentBranch,
          }),
          Lint.ConventionalCommitSettings.make({
            resolvedTypes: context.config.resolvedConventionalCommitTypes,
          }),
        ),
      ),
      Effect.provideService(Lint.MonorepoService, toMonorepo(context.packages)),
      Effect.provideService(Lint.PrService, prContext),
    )
  })

export const createDoctorSummaryForPlan = (
  plan: Planner.Plan,
  report: Lint.Report,
): Commentator.DoctorSummary | undefined =>
  Commentator.createDoctorSummary(report, {
    lifecycle: plan.lifecycle,
    plannedPackages: plan.releases.length + plan.cascades.length,
  })
