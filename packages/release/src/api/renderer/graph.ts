import { Str } from '@kitz/core'
import type { ExecutionGraph } from '../executor/execute.js'

export const renderGraph = (graph: ExecutionGraph): string => {
  const nodeCount = [...graph.nodes.keys()].length
  const output = Str.Builder()

  output`release graph ${Str.Char.middleDot} ${String(nodeCount)} activities ${Str.Char.middleDot} ${String(graph.layers.length)} layers`

  for (let layerIndex = 0; layerIndex < graph.layers.length; layerIndex++) {
    const layer = graph.layers[layerIndex]!
    const isLastLayer = layerIndex === graph.layers.length - 1
    const layerBranch = isLastLayer ? '└─' : '├─'
    const layerIndent = isLastLayer ? '   ' : '│  '

    output`${layerBranch} layer ${String(layerIndex + 1)} (${String(layer.length)})`

    for (let nodeIndex = 0; nodeIndex < layer.length; nodeIndex++) {
      const activity = layer[nodeIndex]!
      const isLastNode = nodeIndex === layer.length - 1
      const nodeBranch = isLastNode ? '└─' : '├─'
      const dependencies = graph.nodes.get(activity)?.dependencies ?? []
      const suffix = dependencies.length > 0 ? ` ← ${dependencies.join(', ')}` : ''
      output`${layerIndent}${nodeBranch} ${activity}${suffix}`
    }
  }

  return output.render()
}
