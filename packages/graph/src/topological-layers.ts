import { Result } from 'effect'
import { CycleError } from './errors.js'

/**
 * Compute topological layers for a dependency graph.
 *
 * Input is a generic adjacency map from node id to the ids of the nodes it
 * depends on. Every node must appear as a key; dependency ids that are not
 * keys can never be satisfied and are reported through {@link CycleError}.
 *
 * Nodes in the same layer have no dependencies on each other, so they may be
 * processed concurrently. Layers are ordered: every node's dependencies live
 * in strictly earlier layers. Within a layer, nodes preserve the input map's
 * insertion order, making the result deterministic.
 *
 * On failure the {@link CycleError} context reports the true cycle members
 * (nodes that can reach themselves through unprocessed nodes) and the
 * dependency edges among them. Nodes that are merely blocked downstream of a
 * cycle are excluded. When the graph stalls without a detectable cycle (e.g.
 * a dependency referencing an unknown node), all stalled nodes are reported
 * with no edges.
 *
 * @example
 * ```ts
 * import { Graph } from '@kitz/graph'
 *
 * const layers = Graph.topologicalLayers(
 *   new Map([
 *     ['a', []],
 *     ['b', ['a']],
 *     ['c', ['a']],
 *     ['d', ['b', 'c']],
 *   ]),
 * )
 * // Result.succeed([['a'], ['b', 'c'], ['d']])
 * ```
 */
export const topologicalLayers = (
  dependencies: ReadonlyMap<string, ReadonlyArray<string>>,
): Result.Result<ReadonlyArray<ReadonlyArray<string>>, CycleError> => {
  const layers: string[][] = []
  const completed = new Set<string>()
  const remaining = new Set(dependencies.keys())

  while (remaining.size > 0) {
    // Find nodes whose dependencies are all completed
    const layer: string[] = []
    for (const name of remaining) {
      const deps = dependencies.get(name) ?? []
      if (deps.every((dep) => completed.has(dep))) {
        layer.push(name)
      }
    }

    if (layer.length === 0) {
      // Cycle detected or unsatisfiable dependencies
      return Result.fail(cycleError(dependencies, remaining))
    }

    // Move layer nodes from remaining to completed
    for (const name of layer) {
      remaining.delete(name)
      completed.add(name)
    }

    layers.push(layer)
  }

  return Result.succeed(layers)
}

/**
 * Build a {@link CycleError} for a stalled layering pass.
 *
 * Reports the nodes that participate in a cycle among the still-unprocessed
 * nodes, falling back to the whole stalled set when no explicit cycle exists.
 */
const cycleError = (
  dependencies: ReadonlyMap<string, ReadonlyArray<string>>,
  remaining: ReadonlySet<string>,
): CycleError => {
  const remainingDependenciesOf = (node: string): string[] =>
    (dependencies.get(node) ?? []).filter((dep) => remaining.has(dep))

  const canReach = (start: string, target: string, seen: Set<string>): boolean => {
    if (start === target) return true
    if (seen.has(start)) return false
    seen.add(start)
    return remainingDependenciesOf(start).some((dep) => canReach(dep, target, seen))
  }

  const cycleNodes = [...remaining].filter((node) =>
    remainingDependenciesOf(node).some((dep) => canReach(dep, node, new Set())),
  )
  const reported = cycleNodes.length > 0 ? cycleNodes : [...remaining]
  const reportedSet = new Set(reported)
  const edges = reported.flatMap((node) =>
    remainingDependenciesOf(node)
      .filter((dep) => reportedSet.has(dep))
      .map((dep): readonly [string, string] => [node, dep]),
  )

  return new CycleError({ context: { nodes: reported, edges } })
}
