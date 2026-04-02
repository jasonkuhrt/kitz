/**
 * @module core
 *
 * Shared utilities for visualization renderers.
 */

import { Fn } from '@kitz/core'
import { Tex } from '@kitz/tex'
import { Ansis } from 'ansis'
import { MutableHashMap } from 'effect'
import { type State as ActivityState, State as ActivityStateSchema } from '../models/activity.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Styler = Fn.endo<string>

export interface Styles {
  readonly dim: Styler
  readonly heading: Styler
  readonly byState: Readonly<Record<ActivityState, Styler>>
}

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
  activities: MutableHashMap.fromIterable(
    activities.map((a) => [a, ActivityStateSchema.enums.pending]),
  ),
  currentActivity: null,
  startTime: new Date(),
  completedCount: 0,
  totalCount: activities.length,
})

export const elapsedSince = (startTime: Date): number =>
  new globalThis.Date().getTime() - startTime.getTime()

// ─── Styling ─────────────────────────────────────────────────────────────────

export const createStyles = (useColors: boolean): Styles => {
  if (!useColors) {
    return {
      dim: Fn.identity,
      heading: Fn.identity,
      byState: {
        completed: Fn.identity,
        running: Fn.identity,
        failed: Fn.identity,
        pending: Fn.identity,
      },
    }
  }

  const ansis = new Ansis(3)

  return {
    dim: (value) => ansis.dim(value),
    heading: (value) => ansis.bold.cyan(value),
    byState: {
      completed: (value) => ansis.green(value),
      running: (value) => ansis.yellow(value),
      failed: (value) => ansis.red(value),
      pending: (value) => ansis.gray(value),
    },
  }
}

export const stateToStyler = (state: ActivityState, styles: Styles): Styler => styles.byState[state]

const stateToSymbolLookup = {
  completed: Tex.Glyph.status.check,
  running: Tex.Glyph.status.filled,
  failed: Tex.Glyph.status.cross,
  pending: Tex.Glyph.status.empty,
} as const satisfies Record<ActivityState, string>

export const stateToSymbol = (state: ActivityState): string => stateToSymbolLookup[state]
