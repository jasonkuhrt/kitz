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

import { Activity } from '@effect/workflow'
import { WorkflowEngine } from '@effect/workflow'
import { Effect, Graph, Option, PubSub, Schema, Stream } from 'effect'
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
  typeof value === 'object'
  && value !== null
  && NodeHandleTypeId in value
  && value[NodeHandleTypeId] === NodeHandleTypeId

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
  readonly after?: NodeHandle<any> | readonly NodeHandle<any>[]
  /** Retry policy for transient failures */
  readonly retry?: { readonly times: number }
}

// ============================================================================
// Internal Graph Builder
// ============================================================================

/**
 * Internal node definition collected by the graph builder.
 */
interface NodeDef {
  readonly name: string
  readonly execute: Effect.Effect<any, any, any>
  readonly dependencies: readonly string[]
  readonly retry?: { readonly times: number } | undefined
}

/**
 * Internal graph builder state.
 */
interface GraphBuilderState {
  readonly nodes: Map<string, NodeDef>
}

/**
 * Normalize after option to array of dependency names.
 */
const normalizeDependencies = (after: NodeHandle<any> | readonly NodeHandle<any>[] | undefined): string[] => {
  if (!after) return []
  if (Array.isArray(after)) {
    return after.map((h) => h.name)
  }
  // Single NodeHandle
  return [(after as NodeHandle<any>).name]
}

/**
 * Create a graph builder that collects node definitions.
 */
const makeGraphBuilder = () => {
  const state: GraphBuilderState = {
    nodes: new Map(),
  }

  const node = <A, E, R>(
    name: string,
    execute: Effect.Effect<A, E, R>,
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
const buildEffectGraph = (nodes: Map<string, NodeDef>): Graph.DirectedGraph<string, void> =>
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
 * Compute topological layers for concurrent execution.
 *
 * Nodes in the same layer have no dependencies on each other
 * and can execute concurrently.
 */
const computeLayers = (nodes: Map<string, NodeDef>): string[][] => {
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
export type UnwrapHandles<T> = T extends NodeHandle<infer A> ? A
  : T extends readonly (infer U)[] ? UnwrapHandles<U>[]
  : T extends Record<string, unknown> ? { [K in keyof T]: UnwrapHandles<T[K]> }
  : T

// ============================================================================
// Workflow Definition
// ============================================================================

/**
 * Configuration for defining a workflow.
 */
export interface WorkflowConfig<
  Name extends string,
  Payload,
  Result,
  Error,
> {
  /** Unique name for the workflow */
  readonly name: Name
  /** Schema for the workflow payload */
  readonly payload: Schema.Schema<Payload, any, never>
  /** Schema for workflow errors */
  readonly error?: Schema.Schema<Error, any, never> | undefined
  /** Compute idempotency key from payload (for durability) */
  readonly idempotencyKey?: ((payload: Payload) => string) | undefined
  /**
   * Define the workflow graph.
   *
   * Use the `node` function to register activities and their dependencies.
   * Return value can contain NodeHandles - they'll be unwrapped to actual results.
   */
  readonly graph: (
    payload: Payload,
    node: <A, E, R>(
      name: string,
      execute: Effect.Effect<A, E, R>,
      options?: NodeOptions,
    ) => NodeHandle<A>,
  ) => Result
}

/**
 * A defined workflow that can be executed or visualized.
 */
export interface WorkflowInstance<
  Name extends string,
  Payload,
  Result,
  Error,
> {
  /** Workflow name */
  readonly name: Name

  /**
   * Build the graph structure from a payload (without executing).
   *
   * Useful for visualization before or without execution.
   */
  readonly toGraph: (payload: Payload) => {
    readonly graph: Graph.DirectedGraph<string, void>
    readonly nodes: ReadonlyMap<string, NodeDef>
    readonly layers: readonly (readonly string[])[]
  }

  /**
   * Execute the workflow with durability.
   *
   * Activities run concurrently where dependencies allow.
   * Completed activities are persisted and skipped on resume.
   */
  readonly execute: (
    payload: Payload,
  ) => Effect.Effect<
    UnwrapHandles<Result>,
    Error,
    WorkflowEngine.WorkflowEngine
  >

  /**
   * Execute the workflow with observable events.
   *
   * Returns a stream of activity events and the execution effect.
   */
  readonly observable: (
    payload: Payload,
  ) => Effect.Effect<
    {
      readonly events: Stream.Stream<LifecycleEvent>
      readonly execute: Effect.Effect<UnwrapHandles<Result>, Error, WorkflowEngine.WorkflowEngine>
    },
    never,
    never
  >
}

// ============================================================================
// Workflow Factory
// ============================================================================

/** Threshold in ms - activities completing faster than this are considered resumed */
const RESUME_THRESHOLD_MS = 50

/**
 * Create a declarative workflow definition.
 *
 * The workflow graph is built from the `graph` function, which uses `node()`
 * to register activities and their dependencies. Nodes execute concurrently
 * when their dependencies are satisfied.
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
export const make = <
  Name extends string,
  Payload,
  Result,
  Error,
>(
  config: WorkflowConfig<Name, Payload, Result, Error>,
): WorkflowInstance<Name, Payload, Result, Error> => {
  const toGraph = (payload: Payload) => {
    const builder = makeGraphBuilder()
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
    Effect.gen(function*() {
      // Build graph
      const builder = makeGraphBuilder()
      const resultTemplate = config.graph(payload, builder.node)
      const layers = computeLayers(builder.state.nodes)

      // Results storage
      const results = new Map<string, unknown>()

      // Get optional event pubsub
      const maybePubsub = emitEvents
        ? yield* Effect.serviceOption(WorkflowEvents)
        : Option.none()

      // Execute layers sequentially, nodes within layer concurrently
      for (const layer of layers) {
        const layerEffects = layer.map((nodeName) => {
          const nodeDef = builder.state.nodes.get(nodeName)!

          return Effect.gen(function*() {
            const startTime = Date.now()

            // Emit start event
            if (Option.isSome(maybePubsub)) {
              yield* maybePubsub.value.publish(
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
              execute: nodeDef.execute as Effect.Effect<unknown, unknown, any>,
            })

            // Build the effect to run (with optional retry)
            const activityEffect = nodeDef.retry
              ? activity.pipe(Activity.retry({ times: nodeDef.retry.times }))
              : activity

            try {
              const result = yield* activityEffect
              results.set(nodeName, result)

              // Emit completion event
              if (Option.isSome(maybePubsub)) {
                const durationMs = Date.now() - startTime
                yield* maybePubsub.value.publish(
                  ActivityModel.Completed.make({
                    activity: nodeName,
                    timestamp: new Date(),
                    durationMs,
                    resumed: durationMs < RESUME_THRESHOLD_MS,
                  }),
                )
              }

              return result
            } catch (error) {
              // Emit failure event
              if (Option.isSome(maybePubsub)) {
                yield* maybePubsub.value.publish(
                  ActivityModel.Failed.make({
                    activity: nodeName,
                    timestamp: new Date(),
                    error: typeof error === 'object' && error !== null && 'message' in error
                      ? String((error as { message: unknown }).message)
                      : String(error),
                  }),
                )
              }
              throw error
            }
          })
        })

        // Execute layer concurrently
        yield* Effect.all(layerEffects, { concurrency: 'unbounded' })
      }

      // Unwrap NodeHandles in result template
      return unwrapResult(resultTemplate, results)
    }) as any

  const execute = (payload: Payload) => executeInternal(payload, false)

  const observable = (payload: Payload) =>
    Effect.gen(function*() {
      const pubsub = yield* PubSub.unbounded<LifecycleEvent>()
      const events = Stream.fromPubSub(pubsub)

      const executeEffect = executeInternal(payload, true).pipe(
        Effect.tap(() =>
          pubsub.publish(
            WorkflowModel.Completed.make({
              timestamp: new Date(),
              durationMs: 0,
            }),
          )
        ),
        Effect.tapErrorCause((cause) =>
          Effect.gen(function*() {
            yield* pubsub.publish(
              WorkflowModel.Failed.make({
                timestamp: new Date(),
                error: String(cause),
              }),
            )
            yield* PubSub.shutdown(pubsub)
          })
        ),
        Effect.ensuring(PubSub.shutdown(pubsub)),
        Effect.provideService(WorkflowEvents, pubsub),
      )

      return { events, execute: executeEffect }
    })

  return {
    name: config.name,
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
