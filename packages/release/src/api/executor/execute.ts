/**
 * @module executor/execute
 *
 * Execution API for the release workflow.
 * Provides both synchronous and observable execution modes.
 */

import { Flo } from '@kitz/flo'
import { Fs } from '@kitz/fs'
import { Effect, HashMap, Match, Option, Schema, Stream } from 'effect'
import type { Plan } from '../planner/models/__.js'
import type { Publishing } from '../publishing.js'
import type { ExecutorError } from './errors.js'
import { makeRuntime, type RuntimeConfig } from './runtime.js'
import { ReleasePayload, type ReleasePayloadType, ReleaseWorkflow } from './workflow.js'

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
export interface ObservableResult {
  /** Stream of activity lifecycle events */
  readonly events: Stream.Stream<Flo.LifecycleEvent>
  /** Effect that executes the workflow and returns the result (runtime layer pre-provided) */
  readonly execute: Effect.Effect<ExecutionResult, ExecutorError>
  /** Graph information for visualization */
  readonly graph: {
    readonly layers: readonly (readonly string[])[]
    readonly nodes: HashMap.HashMap<string, { dependencies: readonly string[] }>
  }
}

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
 * Convert a Plan to workflow payload.
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
): ReleasePayloadType => ({
  releases: [...plan.releases, ...plan.cascades].map((r) => ({
    packageName: r.package.name.moniker,
    packagePath: Fs.Path.toString(r.package.path),
    currentVersion: r.currentVersion.pipe(Option.map((v) => v.toString())),
    nextVersion: r.nextVersion.toString(),
    bump: r.bumpType,
    commits: r.commits.map((c) => {
      const info = c.forScope(r.package.scope)
      return {
        type: info.type,
        message: info.description,
        hash: info.hash,
        breaking: info.breaking,
      }
    }),
  })),
  options: {
    dryRun: options.dryRun ?? false,
    ...(options.tag && { tag: options.tag }),
    ...(options.registry && { registry: options.registry }),
    lifecycle: plan.lifecycle,
    ...(options.publishing && { publishing: options.publishing }),
    ...(options.trunk && { trunk: options.trunk }),
  },
})

/**
 * Execute the release workflow.
 *
 * The workflow is durable - if it fails partway through, calling execute
 * again with the same payload will resume from where it left off.
 *
 * Activities execute concurrently where dependencies allow:
 * - All package publishes run in parallel
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
    const payload = toPayload(plan, options)

    yield* Effect.log(`Starting release workflow for ${payload.releases.length} packages...`)

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
 * **Concurrent execution**: Activities in the same layer run in parallel.
 * Use `graph.layers` to show the execution structure in the UI.
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
): Effect.Effect<ObservableResult, never, never> =>
  Effect.gen(function* () {
    const payload = toPayload(plan, options)

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
    const wrappedExecute = workflowExecute.pipe(
      Effect.map(normalizeWorkflowResult),
      Effect.provide(makeRuntime(runtimeConfig)),
    ) as Effect.Effect<ExecutionResult, ExecutorError>

    return {
      events,
      execute: wrappedExecute,
      graph: graphInfo,
    }
  })
