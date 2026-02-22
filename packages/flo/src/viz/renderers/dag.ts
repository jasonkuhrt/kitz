/**
 * @module dag
 *
 * Full DAG renderer with box-drawing characters.
 *
 * Renders a directed acyclic graph as ASCII art:
 * ```
 * Layer 0          Layer 1          Layer 2
 * ┌────────┐       ┌────────┐       ┌────────┐
 * │ Step A │──────→│ Step B │──────→│ Step D │
 * └────────┘       └────────┘       └────────┘
 *     │            ┌────────┐           ↑
 *     └───────────→│ Step C │───────────┘
 *                  └────────┘
 * ```
 */

import { Str } from '@kitz/core'
import { Tex } from '@kitz/tex'
import ansis from 'ansis'
import { Duration, MutableHashMap, Option } from 'effect'
import * as Core from '../core.js'

// ─── Config ─────────────────────────────────────────────────────────────────

/**
 * Configuration for DAG mode rendering.
 */
export interface Config {
  readonly mode: 'dag'
  /** Topological layers - each layer contains nodes that can run concurrently */
  readonly layers: readonly (readonly string[])[]
  /** Edges as [from, to] pairs */
  readonly edges?: readonly (readonly [string, string])[] | undefined
  /** Whether to use ANSI colors in output (defaults to false) */
  readonly colors?: boolean | undefined
}

// ─── Render ─────────────────────────────────────────────────────────────────

/**
 * Render a DAG as ASCII art with box-drawing characters.
 */
export const render = (
  layers: readonly (readonly string[])[],
  edges: readonly (readonly [string, string])[],
  state: Core.RenderState,
  useColors: boolean,
): string => {
  const space = Str.Char.spaceRegular
  const layerGap = space.repeat(4)
  const hLine = Str.Builder({ join: '' })

  // Calculate max node name visual width for box sizing
  const allNodes = layers.flat()
  const maxNameLen = Math.max(...allNodes.map((n) => Str.Visual.width(n)), 8)
  const boxWidth = maxNameLen + 4 // padding + borders

  // Build node positions: Map<nodeName, { layer, position }>
  const nodePositions = MutableHashMap.empty<string, { layer: number; position: number }>()
  for (let l = 0; l < layers.length; l++) {
    const layer = layers[l]
    if (!layer) continue
    for (let p = 0; p < layer.length; p++) {
      const node = layer[p]
      if (node) {
        MutableHashMap.set(nodePositions, node, { layer: l, position: p })
      }
    }
  }

  // Calculate max nodes per layer for height
  const maxNodesPerLayer = Math.max(...layers.map((l) => l.length))

  // Render each row (each row shows one node from each layer at that position)
  const b = Str.Builder()

  for (let row = 0; row < maxNodesPerLayer; row++) {
    // Three lines per node row: top border, content, bottom border
    const top = hLine()
    const mid = hLine()
    const bot = hLine()

    for (let col = 0; col < layers.length; col++) {
      const layer = layers[col]
      const node = layer?.[row]

      if (node) {
        const activityState = Option.getOrElse(MutableHashMap.get(state.activities, node), () => 'pending' as const)
        const style = Core.stateToStyler(activityState, useColors)
        const symbol = Core.stateToSymbol(activityState)

        // Center name in box using visual width
        const paddedName = Str.Visual.center(node, maxNameLen)

        top(style(
          `${Tex.Glyph.box.corner.topLeft}${
            Tex.Glyph.box.edge.horizontal.repeat(boxWidth - 2)
          }${Tex.Glyph.box.corner.topRight}`,
        ))
        mid(
          `${style(Tex.Glyph.box.edge.vertical)}${symbol}${space}${paddedName}${space}${
            style(Tex.Glyph.box.edge.vertical)
          }`,
        )
        bot(style(
          `${Tex.Glyph.box.corner.bottomLeft}${
            Tex.Glyph.box.edge.horizontal.repeat(boxWidth - 2)
          }${Tex.Glyph.box.corner.bottomRight}`,
        ))
      } else {
        // Empty cell
        const emptyCell = space.repeat(boxWidth)
        top(emptyCell)
        mid(emptyCell)
        bot(emptyCell)
      }

      // Add arrow to next layer if there's an edge
      if (col < layers.length - 1) {
        const hasEdgeToRight = node
          ? edges.some(([from, to]) => {
            const toPos = Option.getOrNull(MutableHashMap.get(nodePositions, to))
            return from === node && toPos?.layer === col + 1
          })
          : false

        if (hasEdgeToRight) {
          top(layerGap)
          mid(`${Tex.Glyph.box.edge.horizontal}${Tex.Glyph.box.edge.horizontal}${Tex.Glyph.arrow.right}${space}`)
          bot(layerGap)
        } else {
          top(layerGap)
          mid(layerGap)
          bot(layerGap)
        }
      }
    }

    b(top.render(), mid.render(), bot.render())

    // Add vertical connectors between rows if needed
    if (row < maxNodesPerLayer - 1) {
      const connector = hLine()
      for (let col = 0; col < layers.length; col++) {
        const currentNode = layers[col]?.[row]
        const nextNode = layers[col]?.[row + 1]

        // Check if there are edges that need vertical lines
        const needsVertical = currentNode
          && edges.some(([from]) =>
            from === currentNode && Option.getOrNull(MutableHashMap.get(nodePositions, from))?.layer === col
          )

        if (needsVertical || nextNode) {
          connector(space.repeat(boxWidth / 2) + Tex.Glyph.box.edge.vertical + space.repeat(boxWidth / 2 - 1))
        } else {
          connector(space.repeat(boxWidth))
        }
        if (col < layers.length - 1) {
          connector(layerGap)
        }
      }
      const connectorStr = connector.render()
      if (connectorStr.trim()) {
        b(connectorStr)
      }
    }
  }

  // Add summary
  const elapsed = Duration.format(Duration.millis(Date.now() - state.startTime.getTime()))
  const summary = `${state.completedCount}/${state.totalCount} completed (${elapsed})`
  b('')
  b(useColors ? ansis.dim(summary) : summary)

  return b.render()
}
