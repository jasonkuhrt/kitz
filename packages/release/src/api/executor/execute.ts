/**
 * @module executor/execute
 *
 * Execution API for the release workflow.
 * Provides both synchronous and observable execution modes.
 */

import { ChildProcessSpawner } from 'effect/unstable/process'
import { Workflow as DurableWorkflow, WorkflowEngine } from 'effect/unstable/workflow'
import { FileSystem } from 'effect'
import { Env } from '@kitz/env'
import { Flo } from '@kitz/flo'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import { Cause, Config, Effect, Exit, Match, Option, Schema, Stream } from 'effect'
import type { Plan } from '../planner/models/__.js'
import type { Publishing } from '../publishing.js'
import {
  ExecutorDependencyCycleError,
  ExecutorPreflightError,
  ExecutorResumeError,
  type ExecutorError,
} from './errors.js'
import { type PreflightError, run as runPreflight } from './preflight.js'
import { makeRuntime, type RuntimeConfig } from './runtime.js'
import {
  ReleasePayload,
  type ReleasePayloadType,
  ReleaseWorkflow,
  toReleaseInfo,
} from './workflow.js'

/**
 * Result of executing the release workflow.
 *
 * Contains the list of packages that were published, tags that were created,
 * and GitHub releases that were created.
 */
export interface ExecutionResult {
  releasedPackages: string[]
  createdTags: string[]
  createdGHReleases: string[]
}

/**
 * Result of observable workflow execution.
 */
export interface ObservableResult<R = never> {
  /** Stream of activity lifecycle events */
  readonly events: Stream.Stream<Flo.LifecycleEvent>
  /**
   * Effect that executes the workflow and returns the result.
   *
   * Workflow runtime services are pre-provided, but caller-owned environment
   * services still come from the runtime boundary that invokes this effect.
   */
  readonly execute: Effect.Effect<ExecutionResult, ObservableExecutionError, R>
  /** Graph information for visualization */
  readonly graph: ExecutionGraph
}

export interface ObservableResumeResult<R = never> extends ObservableResult<R> {
  /** Persisted workflow status that was validated for resume */
  readonly status: ExecutionStatusSuspended
}

export interface ExecutionGraphNode {
  readonly dependencies: readonly string[]
}

export interface ExecutionGraph {
  readonly layers: readonly (readonly string[])[]
  readonly nodes: ReadonlyMap<string, ExecutionGraphNode>
}

export interface ExecutionGraphJson {
  readonly layers: readonly (readonly string[])[]
  readonly nodes: Readonly<Record<string, ExecutionGraphNode>>
}

export type ObservableExecutionRequirements =
  | ChildProcessSpawner.ChildProcessSpawner
  | Env.Env
  | FileSystem.FileSystem
  | Git.Git
  | NpmRegistry.NpmCli

export type ObservableExecutionError = Config.ConfigError | ExecutorError

interface ExecutionOptions {
  readonly dryRun?: boolean
  readonly tag?: string
  readonly registry?: string
  readonly publishing?: Publishing
  readonly trunk?: string
}

interface ObservableExecutionOptions extends ExecutionOptions {
  readonly dbPath?: string
  readonly github?: RuntimeConfig['github']
}

interface ResolvedExecutionState {
  readonly payload: ReleasePayloadType
  readonly status: ExecutionStatus
}

export interface LifecycleEventLine {
  readonly level: 'info' | 'error'
  readonly message: string
}

interface ExecutionStatusBase {
  readonly executionId: string
  readonly lifecycle: Plan['lifecycle']
  readonly plannedPackages: readonly string[]
}

export interface ExecutionStatusNotStarted extends ExecutionStatusBase {
  readonly state: 'not-started'
}

export interface ExecutionStatusSuspended extends ExecutionStatusBase {
  readonly state: 'suspended'
  readonly detail: string | null
}

export interface ExecutionStatusSucceeded extends ExecutionStatusBase {
  readonly state: 'succeeded'
  readonly summary: ExecutionResult
}

export interface ExecutionStatusFailed extends ExecutionStatusBase {
  readonly state: 'failed'
  readonly detail: string
}

export type ExecutionStatus =
  | ExecutionStatusNotStarted
  | ExecutionStatusSuspended
  | ExecutionStatusSucceeded
  | ExecutionStatusFailed

const WorkflowExecutionSchema = Schema.Struct({
  publishes: Schema.Array(Schema.String),
  createTags: Schema.Array(Schema.String),
  createGHReleases: Schema.Array(Schema.String),
})
const decodeWorkflowExecution = Schema.decodeUnknownOption(WorkflowExecutionSchema)

const normalizeWorkflowResult = (result: unknown): ExecutionResult =>
  decodeWorkflowExecution(result).pipe(
    Option.map((value) => ({
      releasedPackages: [...value.publishes],
      createdTags: [...value.createTags],
      createdGHReleases: [...value.createGHReleases],
    })),
    Option.getOrElse(
      (): ExecutionResult => ({
        releasedPackages: [],
        createdTags: [],
        createdGHReleases: [],
      }),
    ),
  )

const summarizeWorkflowStatus = (params: {
  readonly plan: Plan
  readonly payload: ReleasePayloadType
  readonly executionId: string
  readonly result: DurableWorkflow.Result<unknown, ExecutorError> | undefined
}): ExecutionStatus => {
  const base = {
    executionId: params.executionId,
    lifecycle: params.plan.lifecycle,
    plannedPackages: params.payload.releases.map((release) => release.packageName),
  } satisfies ExecutionStatusBase

  if (params.result === undefined) {
    return {
      ...base,
      state: 'not-started',
    }
  }

  if (params.result._tag === 'Suspended') {
    return {
      ...base,
      state: 'suspended',
      detail: params.result.cause ? Cause.pretty(params.result.cause).trim() : null,
    }
  }

  if (Exit.isSuccess(params.result.exit)) {
    return {
      ...base,
      state: 'succeeded',
      summary: normalizeWorkflowResult(params.result.exit.value),
    }
  }

  return {
    ...base,
    state: 'failed',
    detail: Cause.pretty(params.result.exit.cause).trim(),
  }
}

const createResumeError = (
  status: Exclude<ExecutionStatus, ExecutionStatusSuspended>,
): ExecutorResumeError =>
  new ExecutorResumeError({
    context: {
      executionId: status.executionId,
      state: status.state,
      detail:
        status.state === 'not-started'
          ? 'No persisted workflow state exists for this plan yet. Run `release apply` first.'
          : status.state === 'succeeded'
            ? 'This release plan already completed successfully. Generate a new plan before releasing again.'
            : 'This workflow ended in a terminal failure and cannot be resumed automatically.',
    },
  })

const ensureResumableStatus = (
  status: ExecutionStatus,
): Effect.Effect<ExecutionStatusSuspended, ExecutorResumeError> =>
  status.state === 'suspended' ? Effect.succeed(status) : Effect.fail(createResumeError(status))

const resolveExecutionState = (
  plan: Plan,
  options: ExecutionOptions = {},
): Effect.Effect<
  ResolvedExecutionState,
  ExecutorDependencyCycleError,
  FileSystem.FileSystem | WorkflowEngine.WorkflowEngine
> =>
  Effect.gen(function* () {
    const payload = yield* toPayload(plan, options)
    const executionId = yield* ReleaseWorkflow.executionId(payload)
    const result = yield* ReleaseWorkflow.poll(payload)

    return {
      payload,
      status: summarizeWorkflowStatus({
        plan,
        payload,
        executionId,
        result,
      }),
    } satisfies ResolvedExecutionState
  })

export const formatExecutionStatus = (status: ExecutionStatus): string => {
  const lines = [
    `Release workflow status: ${status.state}`,
    `Execution ID: ${status.executionId}`,
    `Lifecycle: ${status.lifecycle}`,
    `Packages: ${status.plannedPackages.join(', ') || '(none)'}`,
  ]

  if (status.state === 'not-started') {
    lines.push('No persisted workflow state exists for this plan yet.')
    return lines.join('\n')
  }

  if (status.state === 'suspended') {
    if (status.detail) {
      lines.push('')
      lines.push('Suspended on:')
      lines.push(status.detail)
    }
    lines.push('')
    lines.push('Resume: fix the blocking issue, then run `release resume` with the same plan.')
    return lines.join('\n')
  }

  if (status.state === 'failed') {
    lines.push('')
    lines.push('Failure:')
    lines.push(status.detail)
    return lines.join('\n')
  }

  lines.push(`Released packages: ${status.summary.releasedPackages.join(', ') || '(none)'}`)
  lines.push(`Created tags: ${status.summary.createdTags.join(', ') || '(none)'}`)
  lines.push(`GitHub releases: ${status.summary.createdGHReleases.join(', ') || '(none)'}`)
  return lines.join('\n')
}

/**
 * Convert workflow lifecycle events to printable log lines.
 */
export const formatLifecycleEvent = (event: Flo.LifecycleEvent): LifecycleEventLine | undefined =>
  Match.value(event).pipe(
    Match.tags({
      ActivityStarted: (e): LifecycleEventLine => ({
        level: 'info',
        message: `  Starting: ${e.activity}`,
      }),
      ActivityCompleted: (e): LifecycleEventLine => ({
        level: 'info',
        message: `\u2713 Completed: ${e.activity}`,
      }),
      ActivityFailed: (e): LifecycleEventLine => ({
        level: 'error',
        message: `\u2717 Failed: ${e.activity} - ${e.error}`,
      }),
    }),
    Match.orElse(() => undefined),
  )

/**
 * Order releases so publish dependencies always appear before their dependents.
 * Cycles are rejected with a clear error instead of dropping dependency edges.
 */
const orderReleaseEntries = (
  entries: ReadonlyArray<ReleasePayloadType['releases'][number]>,
): Effect.Effect<ReleasePayloadType['releases'], ExecutorDependencyCycleError> => {
  const dependencies = Object.fromEntries(
    entries.map((entry) => [
      entry.packageName,
      entry.dependsOn.filter((name) => name !== entry.packageName),
    ]),
  ) as Record<string, readonly string[]>
  let remaining = [...entries]
  const ordered: Array<ReleasePayloadType['releases'][number]> = []
  const resolved: string[] = []

  while (remaining.length > 0) {
    const ready = remaining
      .filter((entry) =>
        (dependencies[entry.packageName] ?? []).every((name) => resolved.includes(name)),
      )
      .toSorted((a, b) => a.packageName.localeCompare(b.packageName))

    if (ready.length === 0) {
      const remainingPackages = remaining
        .map((entry) => entry.packageName)
        .toSorted((a, b) => a.localeCompare(b))
      const canReach = (start: string, target: string, seen: readonly string[] = []): boolean => {
        if (start === target) return true
        if (seen.includes(start)) return false

        return (dependencies[start] ?? [])
          .filter((name) => remainingPackages.includes(name))
          .some((name) => canReach(name, target, [...seen, start]))
      }

      const cyclePackages = remainingPackages.filter((packageName) =>
        (dependencies[packageName] ?? [])
          .filter((name) => remainingPackages.includes(name))
          .some((name) => canReach(name, packageName)),
      )
      const reportedPackages = cyclePackages.length > 0 ? cyclePackages : remainingPackages
      const edges = remaining
        .filter((entry) => reportedPackages.includes(entry.packageName))
        .toSorted((a, b) => a.packageName.localeCompare(b.packageName))
        .flatMap((entry) =>
          (dependencies[entry.packageName] ?? [])
            .filter((name) => reportedPackages.includes(name))
            .toSorted((a, b) => a.localeCompare(b))
            .map((name) => `${entry.packageName} -> ${name}`),
        )

      return Effect.fail(
        new ExecutorDependencyCycleError({
          context: {
            packages: reportedPackages,
            edges,
          },
        }),
      )
    }

    const next = ready[0]
    if (next === undefined) break

    ordered.push({
      ...next,
      dependsOn: next.dependsOn
        .filter((name) => resolved.includes(name))
        .toSorted((a, b) => a.localeCompare(b)),
    })
    remaining = remaining.filter((entry) => entry.packageName !== next.packageName)
    if (!resolved.includes(next.packageName)) {
      resolved.push(next.packageName)
    }
  }

  return Effect.succeed(ordered)
}

/**
 * Convert a Plan to workflow payload, including local dependency edges between
 * the planned packages.
 */
export const toPayload = (
  plan: Plan,
  options: {
    dryRun?: boolean
    tag?: string
    registry?: string
    publishing?: Publishing
    trunk?: string
  } = {},
): Effect.Effect<ReleasePayloadType, ExecutorDependencyCycleError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const planItems = [...plan.releases, ...plan.cascades]
    const localPackageNames = planItems.map((item) => item.package.name.moniker)
    const releaseEntries = yield* Effect.all(
      planItems.map((item) =>
        Effect.gen(function* () {
          const manifest = yield* Pkg.Manifest.resource
            .readOrEmpty(item.package.path)
            .pipe(Effect.orDie)
          return {
            packageName: item.package.name.moniker,
            packagePath: Fs.Path.toString(item.package.path),
            currentVersion: item.currentVersion.pipe(Option.map((v) => v.toString())),
            nextVersion: item.nextVersion.toString(),
            bump: item.bumpType,
            commits: (
              item.commits as unknown as import('../analyzer/models/commit.js').ReleaseCommit[]
            ).map((c) => {
              const info = c.forScope(item.package.scope)
              return {
                type: info.type,
                message: info.description,
                hash: info.hash,
                breaking: info.breaking,
              }
            }),
            dependsOn: Pkg.Manifest.findLocalDependencyNames(manifest, localPackageNames),
          }
        }),
      ),
    )

    const orderedReleases = yield* orderReleaseEntries(releaseEntries)

    return {
      releases: orderedReleases,
      options: {
        dryRun: options.dryRun ?? false,
        ...(options.tag && { tag: options.tag }),
        ...(options.registry && { registry: options.registry }),
        lifecycle: plan.lifecycle,
        ...(options.publishing && { publishing: options.publishing }),
        ...(options.trunk && { trunk: options.trunk }),
      },
    }
  })

const runFreshPreflight = (payload: ReleasePayloadType) =>
  Effect.gen(function* () {
    const hasExistingExecution = yield* ReleaseWorkflow.exists(payload)

    if (payload.options.dryRun || hasExistingExecution) {
      return
    }

    const plannedReleases = payload.releases.map(toReleaseInfo)
    yield* runPreflight(plannedReleases, {
      ...(payload.options.registry && { registry: payload.options.registry }),
      ...(payload.options.lifecycle && { lifecycle: payload.options.lifecycle }),
      ...(payload.options.publishing && { publishing: payload.options.publishing }),
      ...(payload.options.trunk && { trunk: payload.options.trunk }),
    }).pipe(
      Effect.mapError(
        (e: PreflightError) =>
          new ExecutorPreflightError({
            context: {
              check: e.context.check,
              detail: e.message,
            },
          }),
      ),
    )
  })

/**
 * Execute the release workflow.
 *
 * Workflow identity is deterministic - the same payload resolves to the same
 * persisted workflow execution, and fresh-run preflight is skipped once that
 * execution already exists.
 *
 * Activities execute in dependency order with single-flight layer execution:
 * - Fresh-run preflight runs before the durable workflow starts
 * - All package artifacts are prepared before publish begins
 * - Publish ordering follows local package dependency edges
 * - Each tag creation runs after its package publishes
 * - Each tag push runs after its tag is created
 * - Each GitHub release runs after its tag is pushed
 */
export const execute = (plan: Plan, options: ExecutionOptions = {}) =>
  Effect.gen(function* () {
    const payload = yield* toPayload(plan, options)

    yield* Effect.log(`Starting release workflow for ${payload.releases.length} packages...`)
    yield* runFreshPreflight(payload)

    const result = yield* ReleaseWorkflow.execute(payload)
    const summary = normalizeWorkflowResult(result)

    yield* Effect.log(`Workflow complete: ${summary.releasedPackages.length} packages released`)
    return summary
  })

export const resume = (
  plan: Plan,
  options: ExecutionOptions = {},
): Effect.Effect<
  ExecutionResult,
  ExecutorDependencyCycleError | ExecutorResumeError | ExecutorError,
  ObservableExecutionRequirements | WorkflowEngine.WorkflowEngine
> =>
  Effect.gen(function* () {
    const { payload, status: workflowStatus } = yield* resolveExecutionState(plan, options)
    yield* ensureResumableStatus(workflowStatus)

    yield* Effect.log(`Resuming release workflow for ${payload.releases.length} packages...`)

    const result = yield* ReleaseWorkflow.execute(payload)
    const summary = normalizeWorkflowResult(result)

    yield* Effect.log(`Workflow complete: ${summary.releasedPackages.length} packages released`)
    return summary
  })

export const status = (
  plan: Plan,
  options: ExecutionOptions = {},
): Effect.Effect<
  ExecutionStatus,
  ExecutorDependencyCycleError,
  FileSystem.FileSystem | WorkflowEngine.WorkflowEngine
> =>
  Effect.gen(function* () {
    const executionState = yield* resolveExecutionState(plan, options)
    return executionState.status
  })

const graphFromPayload = (payload: ReleasePayloadType): ExecutionGraph => {
  const { layers, nodes } = ReleaseWorkflow.toGraph(payload)

  return {
    layers,
    nodes: nodes as ReadonlyMap<string, ExecutionGraphNode>,
  }
}

export const graph = (
  plan: Plan,
  options: ExecutionOptions = {},
): Effect.Effect<ExecutionGraph, ExecutorDependencyCycleError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const payload = yield* toPayload(plan, options)
    return graphFromPayload(payload)
  })

export const toJsonGraph = (graph: ExecutionGraph): ExecutionGraphJson => ({
  layers: graph.layers.map((layer) => [...layer]),
  nodes: Object.fromEntries(
    [...graph.nodes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, node]) => [name, { dependencies: [...node.dependencies] }]),
  ),
})

/**
 * Execute the release workflow with observable events and graph info.
 *
 * Returns a Stream of activity events, the execution Effect, and graph structure
 * for visualization. The stream emits events as activities start, complete, or fail.
 *
 * **Execution model**: The graph reflects the durable prepare/publish/tag/release
 * workflow, and release runs one activity at a time within each layer so a
 * failed step can suspend cleanly for resume. Fresh-run preflight happens
 * before this graph starts.
 *
 * **Resume handling**: When resuming from a checkpoint, already-completed
 * activities emit events with very short `durationMs` values.
 */
export const executeObservable = (
  plan: Plan,
  options: ObservableExecutionOptions = {},
): Effect.Effect<
  ObservableResult<ObservableExecutionRequirements>,
  ObservableExecutionError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const payload = yield* toPayload(plan, options)
    return yield* makeObservableResult(payload, options)
  })

const makeObservableResult = (
  payload: ReleasePayloadType,
  options: ObservableExecutionOptions = {},
): Effect.Effect<ObservableResult<ObservableExecutionRequirements>, ObservableExecutionError> =>
  Effect.gen(function* () {
    const graphInfo = graphFromPayload(payload)
    const { events, execute: workflowExecute } = yield* ReleaseWorkflow.observable(payload)

    const runtimeConfig: RuntimeConfig = {
      ...(options.dbPath && { dbPath: options.dbPath }),
      ...(options.github && { github: options.github }),
    }

    const wrappedExecute = Effect.gen(function* () {
      yield* runFreshPreflight(payload)
      const result = yield* workflowExecute
      return normalizeWorkflowResult(result)
    }).pipe(Effect.provide(makeRuntime(runtimeConfig)))

    return {
      events,
      execute: wrappedExecute,
      graph: graphInfo,
    }
  })

export const resumeObservable = (
  plan: Plan,
  options: ObservableExecutionOptions = {},
): Effect.Effect<
  ObservableResumeResult<ObservableExecutionRequirements>,
  ObservableExecutionError | ExecutorResumeError,
  FileSystem.FileSystem | WorkflowEngine.WorkflowEngine
> =>
  Effect.gen(function* () {
    const { payload, status: workflowStatus } = yield* resolveExecutionState(plan, options)
    const resumableStatus = yield* ensureResumableStatus(workflowStatus)
    const observable = yield* makeObservableResult(payload, options)

    return {
      ...observable,
      status: resumableStatus,
    }
  })
