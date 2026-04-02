/**
 * @module list
 *
 * Simple list renderer for sequential activity display.
 */

import { Str } from '@kitz/core'
import { Duration, MutableHashMap, Option } from 'effect'
import * as Core from '../core.js'

// ─── Config ─────────────────────────────────────────────────────────────────

/**
 * Configuration for list mode rendering.
 */
export interface Config {
  readonly mode?: 'list' | undefined
  /** List of activity names to track (in order) */
  readonly activities: readonly string[]
  /** Whether to use ANSI colors in output (defaults to false) */
  readonly colors?: boolean | undefined
}

// ─── Render ─────────────────────────────────────────────────────────────────

/**
 * Render activities as a simple vertical list.
 */
export const render = (
  activities: readonly string[],
  state: Core.RenderState,
  useColors: boolean,
): string => {
  const b = Str.Builder()
  const styles = Core.createStyles(useColors)

  for (const name of activities) {
    const activityState = Option.getOrElse(
      MutableHashMap.get(state.activities, name),
      () => 'pending' as const,
    )
    const style = Core.stateToStyler(activityState, styles)
    const symbol = Core.stateToSymbol(activityState)
    b`${style(symbol)} ${name}`
  }

  // Summary line
  const elapsed = Duration.format(Duration.millis(Core.elapsedSince(state.startTime)))
  const summary = `${state.completedCount}/${state.totalCount} completed (${elapsed})`
  b``
  b(styles.dim(summary))

  return b.render()
}
