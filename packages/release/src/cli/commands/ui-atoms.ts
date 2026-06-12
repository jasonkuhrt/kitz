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
import * as Analyzer from '../../api/analyzer/__.js'
import * as Commentator from '../../api/commentator/__.js'
import * as Config from '../../api/config.js'
import * as Explorer from '../../api/explorer/__.js'
import * as Lint from '../../api/lint/__.js'
import * as Planner from '../../api/planner/__.js'
import * as Renderer from '../../api/renderer/__.js'
import * as Version from '../../api/version/__.js'
import {
  ChildProcessSpawnerLayer,
  FileSystemLayer,
  ServicesLayer,
  TerminalLayer,
} from '../../platform.js'
import { loadConfiguredPullRequestDiff, resolveDiffRemote } from './pr-lib-diff.js'
import { plannerFor } from './_shared.js'
import { isReadyCommandWorkspace, loadCommandWorkspace } from './command-workspace.js'
import { createDoctorSummaryForPlan, runDoctorReportForPlan } from './doctor-runtime.js'
import { loadActivePlan } from './plan-file.js'

// ─── Types ───────────────────────────────────────────────────────────

export type Lifecycle = Version.Lifecycle
export type FocusPane = 'packages' | 'plan' | 'doctor' | 'diff'

export interface UiPackage {
  readonly scope: string
  readonly name: string
}

export interface WorkspaceContext {
  readonly config: Config.ResolvedConfig
  readonly analysis: Analyzer.Models.Analysis
  readonly packages: readonly Analyzer.Workspace.Package[]
  readonly uiPackages: readonly UiPackage[]
  readonly currentBranch: string
  readonly diffRemote: string
  readonly pullRequest: Github.PullRequest | null
  readonly diff: Lint.Diff | null
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
    ) => Effect.Effect<Planner.Plan, Effect.Error<ReturnType<typeof buildPlan>>>
    readonly buildDoctorReport: (
      workspace: WorkspaceContext,
      plan: Planner.Plan,
    ) => Effect.Effect<string, Effect.Error<ReturnType<typeof buildDoctorReport>>>
    readonly persistPlan: (
      plan: Planner.Plan,
    ) => Effect.Effect<void, Effect.Error<ReturnType<typeof Planner.Store.writeActive>>>
    readonly clearPersistedPlan: Effect.Effect<
      void,
      Effect.Error<typeof Planner.Store.deleteActive>
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
  const planLocation = yield* Planner.Store.resolveActivePlanLocation.pipe(
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
  const analysis = yield* Analyzer.analyze({
    packages,
    tags,
    resolvedConventionalCommitTypes: config.resolvedConventionalCommitTypes,
    commitOverrides: config.commitOverrides,
  }).pipe(Effect.withSpan('analyze'))
  const diffRemote = resolveDiffRemote(config)
  const pullRequestAttempt = yield* Explorer.resolvePullRequest().pipe(Effect.result)
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
  plannerFor(lifecycle)(
    workspace.analysis,
    { packages: workspace.packages },
    toExcludeOptions(excludedPackages, workspace.uiPackages),
  ).pipe(Effect.withSpan('buildPlan', { attributes: { lifecycle } }))

export const buildDoctorReport = (workspace: WorkspaceContext, plan: Planner.Plan) =>
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
      ? Commentator.renderDoctorSummary(summary)
      : 'Doctor found no issues for the current draft.'
  }).pipe(Effect.withSpan('buildDoctorReport', { attributes: { lifecycle: plan.lifecycle } }))

export const renderPlanText = (plan: Planner.Plan) => {
  const planned = plan.releases.length + plan.cascades.length
  return planned === 0 ? 'No releases planned.' : Renderer.renderPlan(plan)
}

export const serializePlanJson = (plan: Planner.Plan) =>
  // eslint-disable-next-line kitz/schema/no-json-parse -- Serialization for persistence, not IO boundary decoding.
  JSON.stringify(Planner.Plan.encodeSync(plan), null, 2)

// ─── Helpers ─────────────────────────────────────────────────────────

const toExcludeOptions = (
  excluded: readonly string[],
  packages: readonly UiPackage[],
): Planner.Options | undefined => {
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
  | Effect.Services<ReturnType<typeof Planner.Store.writeActive>>

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
      persistPlan: (plan) => Effect.provideContext(Planner.Store.writeActive(plan), services),
      clearPersistedPlan: Effect.provideContext(
        Planner.Store.deleteActive.pipe(Effect.asVoid),
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
  Lint.Preconditions.DefaultLayer,
  Lint.ReleasePlan.DefaultReleasePlanLayer,
  Git.GitLive,
)

export const ReleaseUiLayer = DataLive.pipe(Layer.provide(ReleaseUiDependencies))
