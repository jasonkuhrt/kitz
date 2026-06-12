import { Option } from 'effect'

/**
 * Find a shortest path between two nodes following the adjacency map's edges.
 *
 * Breadth-first search, so the returned path has the fewest possible edges;
 * ties resolve to the path discovered first in adjacency-list order. The path
 * is the full node sequence from `from` to `to` inclusive, where every
 * consecutive pair is an edge in the adjacency map. `from === to` returns
 * `[from]` without consulting any edges. Returns `Option.none()` when no path
 * exists. Cycles are safe — every node is visited at most once.
 *
 * @example
 * ```ts
 * import { Graph } from '@kitz/graph'
 *
 * Graph.findPath(
 *   new Map([
 *     ['a', ['b']],
 *     ['b', ['c']],
 *     ['c', []],
 *   ]),
 *   'a',
 *   'c',
 * )
 * // Option.some(['a', 'b', 'c'])
 * ```
 */
export const findPath = (
  adjacency: ReadonlyMap<string, ReadonlyArray<string>>,
  from: string,
  to: string,
): Option.Option<ReadonlyArray<string>> => {
  if (from === to) return Option.some([from])

  const parents = new Map<string, string>()
  const visited = new Set([from])
  // Index pointer instead of `Array#shift` keeps dequeue O(1).
  const queue = [from]

  for (let index = 0; index < queue.length; index++) {
    const node = queue[index]!
    for (const next of adjacency.get(node) ?? []) {
      if (visited.has(next)) continue
      visited.add(next)
      parents.set(next, node)

      if (next === to) {
        const path = [to]
        for (let parent = node; parent !== from; parent = parents.get(parent)!) {
          path.push(parent)
        }
        path.push(from)
        return Option.some(path.reverse())
      }

      queue.push(next)
    }
  }

  return Option.none()
}
