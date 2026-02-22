/**
 * @module dag-compact
 *
 * Compact DAG renderer showing layers as vertical sections.
 *
 * ```
 * Workflow Progress
 *
 *   Layer 0: ✓ StepA
 *   Layer 1:
 *     ● StepB
 *     ○ StepC
 *   Layer 2: ○ StepD
 * ```
 */

import { Str } from '@kitz/core'
import ansis from 'ansis'
import { Duration, MutableHashMap, Option } from 'effect'
import * as Core from '../core.js'

/**
 * Render a compact DAG showing layers as vertical sections.
 */
export const render = (
  layers: readonly (readonly string[])[],
  _edges: readonly (readonly [string, string])[],
  state: Core.RenderState,
  useColors: boolean,
): string => {
  const b = Str.Builder()

  // Header
  b(useColors ? ansis.bold.cyan('Workflow Progress') : 'Workflow Progress')
  b``

  // Render each layer
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]
    if (!layer) continue

    const layerLabel = useColors ? ansis.dim(`Layer ${i}:`) : `Layer ${i}:`

    if (layer.length === 1) {
      const node = layer[0]!
      const activityState = Option.getOrElse(MutableHashMap.get(state.activities, node), () => 'pending' as const)
      const style = Core.stateToStyler(activityState, useColors)
      const symbol = Core.stateToSymbol(activityState)
      b`  ${layerLabel} ${style(`${symbol} ${node}`)}`
    } else {
      b`  ${layerLabel}`
      for (const node of layer) {
        const activityState = Option.getOrElse(MutableHashMap.get(state.activities, node), () => 'pending' as const)
        const style = Core.stateToStyler(activityState, useColors)
        const symbol = Core.stateToSymbol(activityState)
        b`    ${style(`${symbol} ${node}`)}`
      }
    }
  }

  // Summary
  const elapsed = Duration.format(Duration.millis(Date.now() - state.startTime.getTime()))
  const summary = `${state.completedCount}/${state.totalCount} completed (${elapsed})`
  b``
  b(useColors ? ansis.dim(summary) : summary)

  return b.render()
}
