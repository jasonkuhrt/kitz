/**
 * @module Renderer
 *
 * Terminal visualization for workflow execution.
 *
 * Renders ASCII diagrams with dynamic coloring based on activity progress:
 * - Green: Completed activities
 * - Yellow: Currently executing activity
 * - Red: Failed activities
 * - Gray: Pending activities
 *
 * @example
 * ```ts
 * // Simple list mode
 * const renderer = Renderer.create({
 *   activities: ['Preflight', 'Publish:@kitz/core', 'CreateTag'],
 * })
 *
 * // DAG mode (from workflow graph)
 * const { layers, nodes } = myWorkflow.toGraph(payload)
 * const renderer = Renderer.create({
 *   mode: 'dag',
 *   layers: layers,
 *   edges: Array.from(nodes.values()).flatMap(n =>
 *     n.dependencies.map(dep => [dep, n.name])
 *   ),
 * })
 *
 * yield* events.pipe(
 *   Stream.tap((event) => Effect.sync(() => renderer.update(event))),
 *   Stream.runDrain,
 * )
 * ```
 */

import { Match, MutableHashMap } from 'effect'
import { State as ActivityStateSchema } from '../models/activity.js'
import type { LifecycleEvent } from '../observable/__.js'
import * as Core from './core.js'
import * as Renderers from './renderers/__.js'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Configuration for the renderer.
 */
export type Config = Renderers.List.Config | Renderers.Dag.Config

// ─── Renderer ───────────────────────────────────────────────────────────────

/**
 * Create a stateful renderer.
 *
 * Wraps pure renderers with activity state management. Tracks activity status
 * (pending/running/completed/failed) across events and feeds current state
 * to the underlying pure render functions.
 *
 * Use when you need to:
 * - Track activity progress over time via {@link Renderer.update}
 * - Render snapshots of current state via {@link Renderer.render}
 *
 * For one-shot rendering without state tracking, use the pure renderers directly
 * (e.g., {@link Renderers.List.render}, {@link Renderers.Dag.render}).
 */
export const create = (config: Config): Renderer => {
  const useColors = config.colors ?? false
  const activities = config.mode === 'dag' ? config.layers.flat() : config.activities

  const state = Core.createState(activities)

  // Track mutable state
  let currentActivity: string | null = null
  let completedCount = 0

  const getState = (): Core.RenderState => ({
    activities: state.activities,
    currentActivity,
    startTime: state.startTime,
    completedCount,
    totalCount: state.totalCount,
  })

  // Determine renderers up-front based on config
  const render = config.mode === 'dag'
    ? () => Renderers.DagCompact.render(config.layers, config.edges ?? [], getState(), useColors)
    : () => Renderers.List.render(config.activities, getState(), useColors)

  const renderFull = config.mode === 'dag'
    ? () => Renderers.Dag.render(config.layers, config.edges ?? [], getState(), useColors)
    : () => Renderers.List.render(config.activities, getState(), useColors)

  const update = (event: LifecycleEvent) =>
    Match.value(event).pipe(
      Match.tagsExhaustive({
        ActivityStarted(e) {
          MutableHashMap.set(state.activities, e.activity, ActivityStateSchema.enums.running)
          currentActivity = e.activity
        },
        ActivityCompleted(e) {
          MutableHashMap.set(state.activities, e.activity, ActivityStateSchema.enums.completed)
          completedCount++
          if (currentActivity === e.activity) {
            currentActivity = null
          }
        },
        ActivityFailed(e) {
          MutableHashMap.set(state.activities, e.activity, ActivityStateSchema.enums.failed)
          if (currentActivity === e.activity) {
            currentActivity = null
          }
        },
        WorkflowCompleted() {
          currentActivity = null
        },
        WorkflowFailed() {
          currentActivity = null
        },
      }),
    )

  return { update, render, renderFull, getState }
}

/**
 * Renderer instance.
 */
export interface Renderer {
  /** Update state from an activity event */
  update: (event: LifecycleEvent) => void
  /** Render current state as ASCII string (compact mode for DAG) */
  render: () => string
  /** Render current state as full ASCII diagram (with box drawing) */
  renderFull: () => string
  /** Get current render state */
  getState: () => Core.RenderState
}
