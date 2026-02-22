/**
 * @module core
 *
 * Shared utilities for visualization renderers.
 */

import { Fn } from '@kitz/core'
import { Tex } from '@kitz/tex'
import ansis from 'ansis'
import { MutableHashMap } from 'effect'
import { type State as ActivityState, State as ActivityStateSchema } from '../models/activity.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Styler = Fn.endo<string>

/**
 * State of all activities for rendering.
 */
export interface RenderState {
  readonly activities: MutableHashMap.MutableHashMap<string, ActivityState>
  readonly currentActivity: string | null
  readonly startTime: Date
  readonly completedCount: number
  readonly totalCount: number
}

/**
 * Create initial render state for a list of activities.
 */
export const createState = (activities: readonly string[]): RenderState => ({
  activities: MutableHashMap.fromIterable(activities.map((a) => [a, ActivityStateSchema.enums.pending])),
  currentActivity: null,
  startTime: new Date(),
  completedCount: 0,
  totalCount: activities.length,
})

// ─── Styling ─────────────────────────────────────────────────────────────────

const stateToStylerLookup = {
  completed: ansis.green,
  running: ansis.yellow,
  failed: ansis.red,
  pending: ansis.gray,
} as const satisfies Record<ActivityState, Styler>

export const stateToStyler = (state: ActivityState, useColors: boolean): Styler =>
  useColors ? stateToStylerLookup[state] : Fn.identity

const stateToSymbolLookup = {
  completed: Tex.Glyph.status.check,
  running: Tex.Glyph.status.filled,
  failed: Tex.Glyph.status.cross,
  pending: Tex.Glyph.status.empty,
} as const satisfies Record<ActivityState, string>

export const stateToSymbol = (state: ActivityState): string => stateToSymbolLookup[state]
