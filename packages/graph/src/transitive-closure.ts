/**
 * Compute the transitive closure of a set of seed nodes over an adjacency map.
 *
 * Follows edges breadth-first from every seed and returns every reachable
 * node, seeds included. The result is therefore idempotent:
 * `transitiveClosure(adjacency, transitiveClosure(adjacency, seeds))` equals
 * `transitiveClosure(adjacency, seeds)`.
 *
 * The returned set preserves discovery order: seeds first (in input order),
 * then nodes in breadth-first order. Cycles are safe — every node is visited
 * at most once. Nodes absent from the adjacency map are treated as having no
 * outgoing edges.
 *
 * @example
 * ```ts
 * import { Graph } from '@kitz/graph'
 *
 * Graph.transitiveClosure(
 *   new Map([
 *     ['a', ['b']],
 *     ['b', ['c']],
 *     ['c', []],
 *     ['d', []],
 *   ]),
 *   ['a'],
 * )
 * // Set { 'a', 'b', 'c' }
 * ```
 */
export const transitiveClosure = (
  adjacency: ReadonlyMap<string, ReadonlyArray<string>>,
  seeds: Iterable<string>,
): ReadonlySet<string> => {
  const closure = new Set(seeds)
  // Index pointer instead of `Array#shift` keeps dequeue O(1).
  const queue = [...closure]

  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]!
    for (const next of adjacency.get(node) ?? []) {
      if (closure.has(next)) continue
      closure.add(next)
      queue.push(next)
    }
  }

  return closure
}
