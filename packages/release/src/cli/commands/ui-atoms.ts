/**
 * @module cli/commands/ui-atoms
 *
 * Release UI data effects and the service layer that exposes them to the TUI runtime.
 */
import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Github } from '@kitz/github'
import { Array as A, Effect, FileSystem, Layer, Order, Context } from 'effect'
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

export class Data extends Context.Service<
  Data,
  {
    readonly loadWorkspaceContext: Effect.Effect<
      WorkspaceContext | null,
      Effect.Error<typeof loadWorkspaceContext>
    >
    readonly buildPlan: (
      workspace: WorkspaceContext,
      lifecycle: Lifecycle,
      excludedPackages: readonly string[],
    ) => Effect.Effect<Api.Planner.Plan, Effect.Error<ReturnType<typeof buildPlan>>>
    readonly buildDoctorReport: (
      workspace: WorkspaceContext,
      plan: Api.Planner.Plan,
    ) => Effect.Effect<string, Effect.Error<ReturnType<typeof buildDoctorReport>>>
    readonly persistPlan: (
      plan: Api.Planner.Plan,
    ) => Effect.Effect<void, Effect.Error<ReturnType<typeof Api.Planner.Store.writeActive>>>
    readonly clearPersistedPlan: Effect.Effect<
      void,
      Effect.Error<typeof Api.Planner.Store.deleteActive>
    >
  }
>()('@kitz/release/UiData') {}

// ─── Data Loading Effects ────────────────────────────────────────────

// Each step is wrapped with `Effect.withSpan` so that any failure carries
// diagnostic context naming the step that produced it. Effect 4's structured
// tracing surfaces span names in error reports — the user sees which of the
// ~8 sequential operations actually failed instead of a bare message.
//
// Spans nest under a parent `loadWorkspaceContext` span; the per-step names
// are descriptive verbs (active-plan, persisted-plan-read, etc.).
export const loadWorkspaceContext = Effect.gen(function* () {
  const git = yield* Git.Git
  const workspace = yield* loadCommandWorkspace().pipe(Effect.withSpan('command-workspace'))
  if (!isReadyCommandWorkspace(workspace)) return null

  const { config, packages } = workspace
  const planState = yield* loadActivePlan().pipe(Effect.withSpan('active-plan'))
  const planLocation = yield* Api.Planner.Store.resolveActivePlanLocation.pipe(
    Effect.withSpan('plan-location'),
  )
  const fs = yield* FileSystem.FileSystem
  const persistedPlanTextOption = yield* fs
    .readFileString(Fs.Path.toString(planLocation.file))
    .pipe(Effect.option, Effect.withSpan('persisted-plan-read'))
  const persistedPlanText =
    persistedPlanTextOption._tag === 'Some' ? persistedPlanTextOption.value : undefined
  const currentBranch = yield* git.getCurrentBranch().pipe(Effect.withSpan('git-current-branch'))
  const tags = yield* git.getTags().pipe(Effect.withSpan('git-tags'))
  const analysis = yield* Api.Analyzer.analyze({
    packages,
    tags,
    resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
  }).pipe(Effect.withSpan('analyze'))
  const diffRemote = resolveDiffRemote(config)
  const pullRequestAttempt = yield* Api.Explorer.resolvePullRequest().pipe(Effect.result)
  const pullRequest = pullRequestAttempt._tag === 'Success' ? pullRequestAttempt.success : null
  const diff = pullRequest
    ? yield* loadConfiguredPullRequestDiff({
        config,
        pullRequest,
        packages,
        required: false,
      }).pipe(Effect.withSpan('pr-diff'))
    : null

  const persistedPlanLabel =
    planState._tag === 'PlanLoaded'
      ? `${planState.plan.lifecycle} plan`
      : planState._tag === 'PlanInvalid'
        ? 'invalid plan on disk'
        : 'missing'

  const unsortedUiPackages = A.map(packages, (pkg) => ({
    scope: pkg.scope,
    name: pkg.name.moniker,
  }))
  const uiPackages = A.sortWith(unsortedUiPackages, (pkg) => pkg.scope, Order.String)

  const initialLifecycle = planState._tag === 'PlanLoaded' ? planState.plan.lifecycle : 'official'

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
  }
}).pipe(Effect.withSpan('loadWorkspaceContext'))

export const buildPlan = (
  workspace: WorkspaceContext,
  lifecycle: Lifecycle,
  excludedPackages: readonly string[],
) =>
  Effect.gen(function* () {
    const options = toExcludeOptions(excludedPackages, workspace.uiPackages)
    const ctx = { packages: workspace.packages }

    switch (lifecycle) {
      case 'official':
        return yield* Api.Planner.official(workspace.analysis, ctx, options)
      case 'candidate':
        return yield* Api.Planner.candidate(workspace.analysis, ctx, options)
      case 'ephemeral':
        return yield* Api.Planner.ephemeral(workspace.analysis, ctx, options)
    }
  }).pipe(Effect.withSpan('buildPlan', { attributes: { lifecycle } }))

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
  }).pipe(Effect.withSpan('buildDoctorReport', { attributes: { lifecycle: plan.lifecycle } }))

export const renderPlanText = (plan: Api.Planner.Plan) => {
  const planned = plan.releases.length + plan.cascades.length
  return planned === 0 ? 'No releases planned.' : Api.Renderer.renderPlan(plan)
}

export const serializePlanJson = (plan: Api.Planner.Plan) =>
  // eslint-disable-next-line kitz/schema/no-json-parse -- Serialization for persistence, not IO boundary decoding.
  JSON.stringify(Api.Planner.Plan.encodeSync(plan), null, 2)

// ─── Helpers ─────────────────────────────────────────────────────────

const toExcludeOptions = (
  excluded: readonly string[],
  packages: readonly UiPackage[],
): Api.Planner.Options | undefined => {
  if (excluded.length === 0) return undefined
  const monikers = A.map(
    A.filter(packages, (p) => A.contains(excluded, p.scope)),
    (p) => p.name,
  )
  return monikers.length > 0 ? { exclude: monikers } : undefined
}

type DataRequirements =
  | Effect.Services<typeof loadWorkspaceContext>
  | Effect.Services<ReturnType<typeof buildPlan>>
  | Effect.Services<ReturnType<typeof Api.Planner.Store.writeActive>>

export const DataLive = Layer.effect(
  Data,
  Effect.gen(function* () {
    const services = yield* Effect.context<DataRequirements>()

    return {
      loadWorkspaceContext: Effect.provideContext(loadWorkspaceContext, services),
      buildPlan: (workspace, lifecycle, excludedPackages) =>
        Effect.provideContext(buildPlan(workspace, lifecycle, excludedPackages), services),
      buildDoctorReport: (workspace, plan) =>
        Effect.provideContext(buildDoctorReport(workspace, plan), services),
      persistPlan: (plan) => Effect.provideContext(Api.Planner.Store.writeActive(plan), services),
      clearPersistedPlan: Effect.provideContext(
        Api.Planner.Store.deleteActive.pipe(Effect.asVoid),
        services,
      ),
    }
  }),
)

const ReleaseUiDependencies = Layer.mergeAll(
  Env.Live,
  ServicesLayer,
  FileSystemLayer,
  TerminalLayer,
  ChildProcessSpawnerLayer,
  Api.Lint.Preconditions.DefaultLayer,
  Api.Lint.ReleasePlan.DefaultReleasePlanLayer,
  Git.GitLive,
)

export const ReleaseUiLayer = DataLive.pipe(Layer.provide(ReleaseUiDependencies))
