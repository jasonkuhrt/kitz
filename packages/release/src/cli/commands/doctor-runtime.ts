import { Github } from '@kitz/github'
import { Effect } from 'effect'
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
import { provideLintRunEnv } from '../lint-run-env.js'

export interface DoctorPlanRuntimeContext {
  readonly config: Config.ResolvedConfig
  readonly analysis: Analyzer.Models.Analysis
  readonly packages: readonly Analyzer.Workspace.Package[]
  readonly currentBranch: string
  readonly pullRequest: Github.PullRequest | null
  readonly diff: Lint.Diff | null
  readonly diffRemote: string
}

export const runDoctorReportForPlan = (context: DoctorPlanRuntimeContext, plan: Planner.Plan) =>
  Effect.gen(function* () {
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
              severity: 'warn',
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

    return yield* Lint.check({ config: lintConfig }).pipe(
      provideLintRunEnv({
        config: context.config,
        plan,
        packages: context.packages,
        diff: context.diff,
        pullRequest: context.pullRequest,
        // Execution surface: gate official/candidate plans to the trunk branch.
        branchContext: {
          trunk: context.config.trunk,
          currentBranch: context.currentBranch,
        },
      }),
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
