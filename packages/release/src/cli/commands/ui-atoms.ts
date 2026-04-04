/**
 * @module cli/commands/ui-atoms
 *
 * Reactive data loading for the release UI dashboard.
 * Each function returns an Effect that can be run independently.
 * The React layer (ui-app.tsx) orchestrates when to call each.
 */
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Effect, FileSystem, Layer } from 'effect'
import * as Api from '../../api/__.js'
import {
  ChildProcessSpawnerLayer,
  FileSystemLayer,
  ServicesLayer,
  TerminalLayer,
} from '../../platform.js'
import { loadConfiguredPullRequestDiff, resolveDiffRemote } from '../pr-preview-diff.js'
import { isReadyCommandWorkspace, loadCommandWorkspace } from './command-workspace.js'
import { createDoctorSummaryForPlan, runDoctorReportForPlan } from './doctor-runtime.js'
import { loadActivePlan } from './plan-file.js'

// ─── Types ───────────────────────────────────────────────────────────

export type Lifecycle = Api.Version.Lifecycle
export type SelectionMode = 'all' | 'exclude' | 'include'
export type FocusPane = 'packages' | 'plan' | 'doctor' | 'diff'

export interface UiPackage {
  readonly scope: string
  readonly name: string
}

export interface WorkspaceContext {
  readonly config: Api.Config.ResolvedConfig
  readonly analysis: Api.Analyzer.Models.Analysis
  readonly packages: readonly Api.Analyzer.Workspace.Package[]
  readonly uiPackages: readonly UiPackage[]
  readonly currentBranch: string
  readonly diffRemote: string
  readonly pullRequest: Github.PullRequest | null
  readonly diff: Api.Lint.Diff | null
  readonly persistedPlanPath: string
  readonly persistedPlanLabel: string
  readonly persistedPlanText: string | undefined
  readonly initialLifecycle: Lifecycle
}

// ─── Service Layer ───────────────────────────────────────────────────

export const ReleaseUiLayer = Layer.mergeAll(
  Env.Live,
  ServicesLayer,
  FileSystemLayer,
  TerminalLayer,
  ChildProcessSpawnerLayer,
  Api.Lint.Preconditions.DefaultLayer,
  Api.Lint.ReleasePlan.DefaultReleasePlanLayer,
  Git.GitLive,
)

// ─── Data Loading Effects ────────────────────────────────────────────

export const loadWorkspaceContext = Effect.gen(function* () {
  const git = yield* Git.Git
  const workspace = yield* loadCommandWorkspace()
  if (!isReadyCommandWorkspace(workspace)) return null

  const { config, packages } = workspace
  const planState = yield* loadActivePlan()
  const planLocation = yield* Api.Planner.Store.resolveActivePlanLocation
  const fs = yield* FileSystem.FileSystem
  const persistedPlanTextOption = yield* fs
    .readFileString(Fs.Path.toString(planLocation.file))
    .pipe(Effect.option)
  const persistedPlanText =
    persistedPlanTextOption._tag === 'Some' ? persistedPlanTextOption.value : undefined
  const currentBranch = yield* git.getCurrentBranch()
  const tags = yield* git.getTags()
  const analysis = yield* Api.Analyzer.analyze({
    packages,
    tags,
    resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
  })
  const diffRemote = resolveDiffRemote(config)
  const pullRequestAttempt = yield* Api.Explorer.resolvePullRequest().pipe(Effect.result)
  const pullRequest = pullRequestAttempt._tag === 'Success' ? pullRequestAttempt.success : null
  const diff = pullRequest
    ? yield* loadConfiguredPullRequestDiff({ config, pullRequest, packages, required: false })
    : null

  const persistedPlanLabel =
    planState._tag === 'PlanLoaded'
      ? `${planState.plan.lifecycle} plan`
      : planState._tag === 'PlanInvalid'
        ? 'invalid plan on disk'
        : 'missing'

  const uiPackages: readonly UiPackage[] = [...packages]
    .map((pkg) => ({ scope: pkg.scope, name: pkg.name.moniker }))
    .toSorted((a, b) => a.scope.localeCompare(b.scope))

  const initialLifecycle: Lifecycle =
    planState._tag === 'PlanLoaded' ? planState.plan.lifecycle : 'official'

  return {
    config,
    analysis,
    packages,
    uiPackages,
    currentBranch,
    diffRemote,
    pullRequest,
    diff,
    persistedPlanPath: Fs.Path.toString(planLocation.file),
    persistedPlanLabel,
    persistedPlanText,
    initialLifecycle,
  } satisfies WorkspaceContext
})

export const buildPlan = (
  workspace: WorkspaceContext,
  lifecycle: Lifecycle,
  selectionMode: SelectionMode,
  selectedPackages: readonly string[],
) =>
  Effect.gen(function* () {
    const options = toPlannerOptions(selectionMode, selectedPackages, workspace.uiPackages)
    const ctx = { packages: workspace.packages }

    switch (lifecycle) {
      case 'official':
        return yield* Api.Planner.official(workspace.analysis, ctx, options)
      case 'candidate':
        return yield* Api.Planner.candidate(workspace.analysis, ctx, options)
      case 'ephemeral':
        return yield* Api.Planner.ephemeral(workspace.analysis, ctx, options)
    }
  })

export const buildDoctorReport = (workspace: WorkspaceContext, plan: Api.Planner.Plan) =>
  Effect.gen(function* () {
    const report = yield* runDoctorReportForPlan(
      {
        config: workspace.config,
        analysis: workspace.analysis,
        packages: workspace.packages,
        currentBranch: workspace.currentBranch,
        pullRequest: workspace.pullRequest,
        diff: workspace.diff,
        diffRemote: workspace.diffRemote,
      },
      plan,
    )
    const summary = createDoctorSummaryForPlan(plan, report)
    return summary
      ? Api.Commentator.renderDoctorSummary(summary)
      : 'Doctor found no issues for the current draft.'
  })

export const renderPlanText = (plan: Api.Planner.Plan): string => {
  const planned = plan.releases.length + plan.cascades.length
  return planned === 0 ? 'No releases planned.' : Api.Renderer.renderPlan(plan)
}

export const serializePlanJson = (plan: Api.Planner.Plan): string =>
  // eslint-disable-next-line kitz/schema/no-json-parse -- Serialization for persistence, not IO boundary decoding.
  JSON.stringify(Api.Planner.Plan.encodeSync(plan), null, 2)

// ─── Helpers ─────────────────────────────────────────────────────────

const toPlannerOptions = (
  mode: SelectionMode,
  selected: readonly string[],
  packages: readonly UiPackage[],
): Api.Planner.Options | undefined => {
  if (mode === 'all') return undefined
  const monikers = packages.filter((p) => selected.includes(p.scope)).map((p) => p.name)
  if (mode === 'include') return { packages: monikers }
  return monikers.length > 0 ? { exclude: monikers } : undefined
}
