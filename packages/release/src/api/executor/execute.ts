/**
 * @module executor/execute
 *
 * Execution API for the release workflow.
 * Provides both synchronous and observable execution modes.
 */

import { CommandExecutor, FileSystem } from '@effect/platform'
import { Env } from '@kitz/env'
import { Flo } from '@kitz/flo'
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { NpmRegistry } from '@kitz/npm-registry'
import { Pkg } from '@kitz/pkg'
import type * as ConfigError from 'effect/ConfigError'
import { Effect, HashMap, Match, Option, Schema, Stream } from 'effect'
import type { Plan } from '../planner/models/__.js'
import type { Publishing } from '../publishing.js'
import { ExecutorPreflightError, type ExecutorError } from './errors.js'
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
  readonly graph: {
    readonly layers: readonly (readonly string[])[]
    readonly nodes: HashMap.HashMap<string, { dependencies: readonly string[] }>
  }
}

export type ObservableExecutionRequirements =
  | CommandExecutor.CommandExecutor
  | Env.Env
  | FileSystem.FileSystem
  | Git.Git
  | NpmRegistry.NpmCli

export type ObservableExecutionError = ConfigError.ConfigError | ExecutorError

export interface LifecycleEventLine {
  readonly level: 'info' | 'error'
  readonly message: string
}

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
 * Cycles are broken deterministically by package name.
 */
const orderReleaseEntries = (
  entries: ReadonlyArray<ReleasePayloadType['releases'][number]>,
): ReleasePayloadType['releases'] => {
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

    const next =
      ready[0] ?? remaining.toSorted((a, b) => a.packageName.localeCompare(b.packageName))[0]
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

  return ordered
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
): Effect.Effect<ReleasePayloadType, never, FileSystem.FileSystem> =>
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
            commits: item.commits.map((c) => {
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

    return {
      releases: orderReleaseEntries(releaseEntries),
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
export const execute = (
  plan: Plan,
  options: {
    dryRun?: boolean
    tag?: string
    registry?: string
    publishing?: Publishing
    trunk?: string
  } = {},
) =>
  Effect.gen(function* () {
    const payload = yield* toPayload(plan, options)

    yield* Effect.log(`Starting release workflow for ${payload.releases.length} packages...`)
    yield* runFreshPreflight(payload)

    const result = yield* ReleaseWorkflow.execute(payload)
    const summary = normalizeWorkflowResult(result)

    yield* Effect.log(`Workflow complete: ${summary.releasedPackages.length} packages released`)
    return summary
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
  options: {
    dryRun?: boolean
    tag?: string
    registry?: string
    publishing?: Publishing
    trunk?: string
    dbPath?: string
    github?: RuntimeConfig['github']
  } = {},
): Effect.Effect<ObservableResult<ObservableExecutionRequirements>, never, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const payload = yield* toPayload(plan, options)

    // Get graph structure for visualization
    const { layers, nodes } = ReleaseWorkflow.toGraph(payload)
    const typedNodes = nodes as ReadonlyMap<string, { dependencies: readonly string[] }>

    // Build edges for renderer
    const graphInfo = {
      layers,
      nodes: HashMap.fromIterable(typedNodes.entries()),
    }

    // Get observable execution
    const { events, execute: workflowExecute } = yield* ReleaseWorkflow.observable(payload)

    const runtimeConfig: RuntimeConfig = {
      ...(options.dbPath && { dbPath: options.dbPath }),
      ...(options.github && { github: options.github }),
    }

    // Wrap execute to extract results and provide workflow runtime
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
