/**
 * @module workflow
 *
 * Declarative workflow definition with DAG-based execution.
 *
 * Provides a single declaration that derives:
 * - Effect.Graph for visualization
 * - Concurrent execution respecting dependencies
 * - Integration with @effect/workflow for durability
 *
 * @example
 * ```ts
 * const MyWorkflow = Flo.Workflow.make({
 *   name: 'MyWorkflow',
 *   payload: PayloadSchema,
 *   error: ErrorSchema,
 *
 *   graph: (payload, node) => {
 *     const a = node('StepA', doA(payload))
 *     const b = node('StepB', doB(), { after: a })
 *     const c = node('StepC', doC(), { after: a })
 *     node('StepD', doD(), { after: [b, c] })
 *
 *     return { resultB: b, resultC: c }
 *   },
 * })
 *
 * // Execute with durability
 * const result = yield* MyWorkflow.execute(payload)
 *
 * // Get graph for visualization (without executing)
 * const graph = MyWorkflow.toGraph(payload)
 * ```
 */

import { Activity, Workflow as EffectWorkflow } from 'effect/unstable/workflow'
import { WorkflowEngine } from 'effect/unstable/workflow'
import { Cause, Clock, Effect, Exit, Fiber, Graph, Option, PubSub, Schema, Stream } from 'effect'
import { Activity as ActivityModel, Workflow as WorkflowModel } from '../models/__.js'
import { type LifecycleEvent, WorkflowEvents } from '../observable/__.js'

// ============================================================================
// Node Handle
// ============================================================================

/**
 * Unique symbol for NodeHandle type identification.
 */
const NodeHandleTypeId = Symbol.for('@kitz/flo/NodeHandle')

/**
 * A lightweight reference to a node in the workflow graph.
 *
 * Carries phantom type information for the node's result type.
 * Used for:
 * - Declaring dependencies between nodes
 * - Mapping results in the workflow output
 */
export interface NodeHandle<out A> {
  readonly [NodeHandleTypeId]: typeof NodeHandleTypeId
  readonly name: string
  /** @internal Phantom type for result inference */
  readonly __result?: A
}

/**
 * Check if a value is a NodeHandle.
 */
const isNodeHandle = (value: unknown): value is NodeHandle<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  NodeHandleTypeId in value &&
  value[NodeHandleTypeId] === NodeHandleTypeId

/**
 * Create a NodeHandle.
 */
const makeNodeHandle = <A>(name: string): NodeHandle<A> => ({
  [NodeHandleTypeId]: NodeHandleTypeId,
  name,
})

// ============================================================================
// Node Options
// ============================================================================

/**
 * Options for defining a node in the workflow graph.
 */
export interface NodeOptions {
  /** Dependencies - nodes that must complete before this one */
  readonly after?: NodeHandle<unknown> | readonly NodeHandle<unknown>[]
  /** Retry policy for transient failures */
  readonly retry?: { readonly times: number }
}

// ============================================================================
// Internal Graph Builder
// ============================================================================

/**
 * Internal node definition collected by the graph builder.
 */
interface NodeDef<Error> {
  readonly name: string
  readonly execute: Effect.Effect<unknown, Error, unknown>
  readonly dependencies: readonly string[]
  readonly retry?: { readonly times: number } | undefined
}

/**
 * Internal graph builder state.
 */
interface GraphBuilderState<Error> {
  readonly nodes: Map<string, NodeDef<Error>>
}

/**
 * Normalize after option to array of dependency names.
 */
const normalizeDependencies = (
  after: NodeHandle<unknown> | readonly NodeHandle<unknown>[] | undefined,
): string[] => {
  if (!after) return []
  if (isNodeHandleArray(after)) {
    return after.map((h) => h.name)
  }
  return [after.name]
}

const isNodeHandleArray = (
  value: NodeHandle<unknown> | readonly NodeHandle<unknown>[],
): value is readonly NodeHandle<unknown>[] => Array.isArray(value)

/**
 * Create a graph builder that collects node definitions.
 */
const makeGraphBuilder = <Error>() => {
  const state: GraphBuilderState<Error> = {
    nodes: new Map(),
  }

  const node = <A, R>(
    name: string,
    execute: Effect.Effect<A, Error, R>,
    options?: NodeOptions,
  ): NodeHandle<A> => {
    const dependencies = normalizeDependencies(options?.after)

    // Register node
    state.nodes.set(name, {
      name,
      execute,
      dependencies,
      retry: options?.retry,
    })

    return makeNodeHandle<A>(name)
  }

  return { node, state }
}

// ============================================================================
// Graph Utilities
// ============================================================================

/**
 * Build an Effect.Graph from node definitions.
 */
const buildEffectGraph = <Error>(
  nodes: Map<string, NodeDef<Error>>,
): Graph.DirectedGraph<string, void> =>
  Graph.directed<string, void>((g) => {
    // Add all nodes first
    const nodeIndices = new Map<string, number>()
    for (const [name] of nodes) {
      const idx = Graph.addNode(g, name)
      nodeIndices.set(name, idx)
    }

    // Add edges (dependency -> dependent)
    for (const [name, def] of nodes) {
      const toIdx = nodeIndices.get(name)!
      for (const depName of def.dependencies) {
        const fromIdx = nodeIndices.get(depName)
        if (fromIdx !== undefined) {
          Graph.addEdge(g, fromIdx, toIdx, undefined)
        }
      }
    }
  })

/**
 * Compute topological layers for dependency-aware execution.
 *
 * Nodes in the same layer have no dependencies on each other and may execute
 * concurrently if the workflow's configured layer concurrency allows it.
 */
const computeLayers = <Error>(nodes: Map<string, NodeDef<Error>>): string[][] => {
  const layers: string[][] = []
  const completed = new Set<string>()
  const remaining = new Set(nodes.keys())

  while (remaining.size > 0) {
    // Find nodes whose dependencies are all completed
    const layer: string[] = []
    for (const name of remaining) {
      const def = nodes.get(name)!
      const depsCompleted = def.dependencies.every((d) => completed.has(d))
      if (depsCompleted) {
        layer.push(name)
      }
    }

    if (layer.length === 0) {
      // Cycle detected or invalid graph
      throw new Error(`Cycle detected in workflow graph. Remaining: ${[...remaining].join(', ')}`)
    }

    // Move layer nodes from remaining to completed
    for (const name of layer) {
      remaining.delete(name)
      completed.add(name)
    }

    layers.push(layer)
  }

  return layers
}

// ============================================================================
// Result Unwrapping
// ============================================================================

/**
 * Recursively unwrap NodeHandles in a value, replacing them with actual results.
 */
const unwrapResult = <T>(value: T, results: Map<string, unknown>): UnwrapHandles<T> => {
  if (isNodeHandle(value)) {
    return results.get(value.name) as UnwrapHandles<T>
  }

  if (Array.isArray(value)) {
    return value.map((v) => unwrapResult(v, results)) as UnwrapHandles<T>
  }

  if (typeof value === 'object' && value !== null) {
    const unwrapped: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      unwrapped[k] = unwrapResult(v, results)
    }
    return unwrapped as UnwrapHandles<T>
  }

  return value as UnwrapHandles<T>
}

/**
 * Type-level unwrapping of NodeHandles.
 */
export type UnwrapHandles<T> =
  T extends NodeHandle<infer A>
    ? A
    : T extends readonly (infer U)[]
      ? UnwrapHandles<U>[]
      : T extends Record<string, unknown>
        ? { [K in keyof T]: UnwrapHandles<T[K]> }
        : T

// ============================================================================
// Workflow Definition
// ============================================================================

/**
 * Configuration for defining a workflow.
 */
export interface WorkflowConfig<Name extends string, Payload, Result, Error> {
  /** Unique name for the workflow */
  readonly name: Name
  /** Schema for the workflow payload */
  readonly payload: Schema.Codec<Payload, any>
  /** Schema for workflow errors */
  readonly error?: Schema.Codec<Error, any> | undefined
  /** Compute idempotency key from payload (for durability) */
  readonly idempotencyKey?: ((payload: Payload) => string) | undefined
  /**
   * Maximum concurrency for nodes in the same topological layer.
   *
   * Defaults to `unbounded`.
   */
  readonly layerConcurrency?: number | 'unbounded' | undefined
  /**
   * Define the workflow graph.
   *
   * Use the `node` function to register activities and their dependencies.
   * Return value can contain NodeHandles - they'll be unwrapped to actual results.
   */
  readonly graph: (
    payload: Payload,
    node: <A, R>(
      name: string,
      execute: Effect.Effect<A, Error, R>,
      options?: NodeOptions,
    ) => NodeHandle<A>,
  ) => Result
}

/**
 * A defined workflow that can be executed or visualized.
 */
export interface WorkflowInstance<Name extends string, Payload, Result, Error> {
  /** Workflow name */
  readonly name: Name

  /** Deterministic execution identity for a payload. */
  readonly executionId: (payload: Payload) => Effect.Effect<string>

  /** Poll the durable runtime for the current execution state of a payload. */
  readonly poll: (
    payload: Payload,
  ) => Effect.Effect<
    EffectWorkflow.Result<UnwrapHandles<Result>, Error> | undefined,
    never,
    WorkflowEngine.WorkflowEngine
  >

  /** True when this payload already has persisted workflow state. */
  readonly exists: (
    payload: Payload,
  ) => Effect.Effect<boolean, never, WorkflowEngine.WorkflowEngine>

  /**
   * Build the graph structure from a payload (without executing).
   *
   * Useful for visualization before or without execution.
   */
  readonly toGraph: (payload: Payload) => {
    readonly graph: Graph.DirectedGraph<string, void>
    readonly nodes: ReadonlyMap<string, NodeDef<Error>>
    readonly layers: readonly (readonly string[])[]
  }

  /**
   * Execute the workflow with durability.
   *
   * Activities run in dependency order, with configurable within-layer
   * concurrency. Completed activities are persisted and skipped on resume.
   */
  readonly execute: (
    payload: Payload,
  ) => Effect.Effect<UnwrapHandles<Result>, Error, WorkflowEngine.WorkflowEngine>

  /**
   * Execute the workflow with observable events.
   *
   * Returns a stream of activity events and the execution effect.
   */
  readonly observable: (payload: Payload) => Effect.Effect<{
    readonly events: Stream.Stream<LifecycleEvent>
    readonly execute: Effect.Effect<UnwrapHandles<Result>, Error, WorkflowEngine.WorkflowEngine>
  }>
}

// ============================================================================
// Workflow Factory
// ============================================================================

/** Threshold in ms - activities completing faster than this are considered resumed */
const RESUME_THRESHOLD_MS = 50

const defaultIdempotencyKey = (payload: unknown): string => JSON.stringify(payload)

/**
 * Create a declarative workflow definition.
 *
 * The workflow graph is built from the `graph` function, which uses `node()`
 * to register activities and their dependencies. Nodes execute in dependency
 * order, with configurable within-layer concurrency.
 *
 * @example
 * ```ts
 * const MyWorkflow = Workflow.make({
 *   name: 'MyWorkflow',
 *   payload: Schema.Struct({ input: Schema.String }),
 *   error: MyError,
 *
 *   graph: (payload, node) => {
 *     const step1 = node('Step1', doStep1(payload.input))
 *     const step2 = node('Step2', doStep2(), { after: step1 })
 *     return { result: step2 }
 *   },
 * })
 *
 * const result = yield* MyWorkflow.execute({ input: 'hello' })
 * // result: { result: Step2Result }
 * ```
 */
export const make = <Name extends string, Payload, Result, Error>(
  config: WorkflowConfig<Name, Payload, Result, Error>,
): WorkflowInstance<Name, Payload, Result, Error> => {
  const workflow = EffectWorkflow.make({
    name: config.name,
    payload: config.payload as any,
    success: Schema.Unknown,
    error: (config.error ?? Schema.Never) as any,
    idempotencyKey: (config.idempotencyKey ?? defaultIdempotencyKey) as any,
  }).annotate(EffectWorkflow.SuspendOnFailure, true)

  const toGraph = (payload: Payload) => {
    const builder = makeGraphBuilder<Error>()
    config.graph(payload, builder.node)

    const graph = buildEffectGraph(builder.state.nodes)
    const layers = computeLayers(builder.state.nodes)

    return {
      graph,
      nodes: builder.state.nodes,
      layers,
    }
  }

  const executeInternal = (
    payload: Payload,
    emitEvents: boolean,
  ): Effect.Effect<UnwrapHandles<Result>, Error, WorkflowEngine.WorkflowEngine> =>
    Effect.gen(function* () {
      // Build graph
      const builder = makeGraphBuilder<Error>()
      const resultTemplate = config.graph(payload, builder.node)
      const layers = computeLayers(builder.state.nodes)

      // Results storage
      const results = new Map<string, unknown>()

      // Get optional event pubsub
      const maybePubsub = emitEvents ? yield* Effect.serviceOption(WorkflowEvents) : Option.none()

      // Execute layers sequentially, with configurable within-layer concurrency.
      for (const layer of layers) {
        const layerEffects = layer.map((nodeName) => {
          const nodeDef = builder.state.nodes.get(nodeName)!

          return Effect.gen(function* () {
            const startTime = yield* Clock.currentTimeMillis

            // Emit start event
            if (Option.isSome(maybePubsub)) {
              yield* PubSub.publish(
                maybePubsub.value,
                ActivityModel.Started.make({
                  activity: nodeName,
                  timestamp: new Date(),
                  resumed: false,
                }),
              )
            }

            // Create activity with durability
            // Use Schema.Unknown to allow any return type from user effects
            const activity = Activity.make({
              name: nodeName,
              success: Schema.Unknown,
              error: Schema.Unknown,
              execute: nodeDef.execute,
            })

            // Build the effect to run (with optional retry)
            const activityEffect = nodeDef.retry
              ? activity.asEffect().pipe(Activity.retry({ times: nodeDef.retry.times }))
              : activity.asEffect()

            return yield* activityEffect.pipe(
              Effect.matchEffect({
                onSuccess: (result) =>
                  Effect.gen(function* () {
                    results.set(nodeName, result)

                    // Emit completion event
                    if (Option.isSome(maybePubsub)) {
                      const durationMs = (yield* Clock.currentTimeMillis) - startTime
                      yield* PubSub.publish(
                        maybePubsub.value,
                        ActivityModel.Completed.make({
                          activity: nodeName,
                          timestamp: new Date(),
                          durationMs,
                          resumed: durationMs < RESUME_THRESHOLD_MS,
                        }),
                      )
                    }

                    return result
                  }),
                onFailure: (error) =>
                  Effect.gen(function* () {
                    // Emit failure event
                    if (Option.isSome(maybePubsub)) {
                      const errorMessage = error instanceof Error ? error.message : String(error)
                      yield* PubSub.publish(
                        maybePubsub.value,
                        ActivityModel.Failed.make({
                          activity: nodeName,
                          timestamp: new Date(),
                          error: errorMessage,
                        }),
                      )
                    }
                    return yield* Effect.fail(error)
                  }),
              }),
            )
          })
        })

        // Execute the current layer using the workflow's configured concurrency.
        yield* Effect.all(layerEffects, {
          concurrency: config.layerConcurrency ?? 'unbounded',
        })
      }

      // Unwrap NodeHandles in result template
      return unwrapResult(resultTemplate, results)
    }) as any

  const startOrResume = (
    payload: Payload,
  ): Effect.Effect<UnwrapHandles<Result>, Error, WorkflowEngine.WorkflowEngine> =>
    Effect.gen(function* () {
      const executionId = yield* workflow.executionId(payload as any)
      const existing = yield* workflow.poll(executionId)
      const fromExit = <A, E>(exit: Exit.Exit<A, E>) =>
        Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause)
      const fromSuspended = (result: { readonly cause?: Cause.Cause<never> | undefined }) =>
        result.cause
          ? Effect.fail(Cause.squash(result.cause) as Error extends never ? never : Error)
          : Effect.die(`${config.name} suspended without a failure cause`)
      const waitForTerminalResult = () =>
        Effect.gen(function* () {
          while (true) {
            const result = yield* workflow.poll(executionId)
            if (result === undefined) {
              yield* Effect.sleep(50)
              continue
            }

            if (result._tag === 'Complete') {
              return yield* fromExit(result.exit)
            }

            return yield* fromSuspended(result)
          }
        }) as Effect.Effect<UnwrapHandles<Result>, Error, WorkflowEngine.WorkflowEngine>

      if (existing === undefined) {
        const launchFiber = yield* workflow
          .execute(payload as any)
          .pipe(Effect.result, Effect.forkChild)
        return yield* waitForTerminalResult().pipe(Effect.ensuring(Fiber.interrupt(launchFiber)))
      }

      if (existing._tag === 'Complete' && Exit.isSuccess(existing.exit)) {
        return yield* fromExit(existing.exit)
      }

      yield* workflow.resume(executionId)
      return yield* waitForTerminalResult()
    }) as Effect.Effect<UnwrapHandles<Result>, Error, WorkflowEngine.WorkflowEngine>

  const executionId = (payload: Payload) => workflow.executionId(payload as any)

  const poll = (payload: Payload) =>
    Effect.gen(function* () {
      const id = yield* executionId(payload)
      return (yield* workflow.poll(id)) as
        | EffectWorkflow.Result<UnwrapHandles<Result>, Error>
        | undefined
    })

  const exists = (payload: Payload) =>
    Effect.gen(function* () {
      return (yield* poll(payload)) !== undefined
    })

  const execute = (payload: Payload) =>
    startOrResume(payload).pipe(
      Effect.provide(
        workflow.toLayer((registeredPayload) => executeInternal(registeredPayload, false)),
      ),
    ) as Effect.Effect<UnwrapHandles<Result>, Error, WorkflowEngine.WorkflowEngine>

  const observable = (payload: Payload) =>
    Effect.gen(function* () {
      const pubsub = yield* PubSub.unbounded<LifecycleEvent>()
      const events = Stream.fromPubSub(pubsub)

      const executeEffect = startOrResume(payload).pipe(
        Effect.provide(
          workflow.toLayer((registeredPayload) =>
            executeInternal(registeredPayload, true).pipe(
              Effect.provideService(WorkflowEvents, pubsub),
            ),
          ),
        ),
        Effect.tap(() =>
          PubSub.publish(
            pubsub,
            WorkflowModel.Completed.make({
              timestamp: new Date(),
              durationMs: 0,
            }),
          ),
        ),
        Effect.tapCause((cause: Cause.Cause<unknown>) =>
          Effect.gen(function* () {
            yield* PubSub.publish(
              pubsub,
              WorkflowModel.Failed.make({
                timestamp: new Date(),
                error: String(cause),
              }),
            )
            yield* PubSub.shutdown(pubsub)
          }),
        ),
        Effect.ensuring(PubSub.shutdown(pubsub)),
      ) as Effect.Effect<UnwrapHandles<Result>, Error, WorkflowEngine.WorkflowEngine>

      return { events, execute: executeEffect }
    })

  return {
    name: config.name,
    executionId,
    poll,
    exists,
    toGraph,
    execute,
    observable,
  }
}

// ============================================================================
// Namespace Export
// ============================================================================

export const Workflow = {
  make,
} as const
