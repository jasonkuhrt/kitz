import { Graph } from '#graph'
import { Test } from '@kitz/test'
import { describe, expect, test } from 'bun:test'
import { Option } from 'effect'
import * as fc from 'fast-check'

const adjacency = (
  entries: Record<string, readonly string[]>,
): ReadonlyMap<string, readonly string[]> => new Map(Object.entries(entries))

const arbNode = fc.integer({ min: 0, max: 7 }).map((n) => `n${n}`)
const arbAdjacency = fc
  .array(fc.tuple(arbNode, fc.array(arbNode, { maxLength: 4 })), { maxLength: 12 })
  .map((entries) => new Map(entries) as ReadonlyMap<string, readonly string[]>)

describe('Graph.findPath', () => {
  test('finds a direct edge', () => {
    expect(Graph.findPath(adjacency({ a: ['b'], b: [] }), 'a', 'b')).toEqual(
      Option.some(['a', 'b']),
    )
  })

  test('finds a multi-hop path', () => {
    expect(Graph.findPath(adjacency({ a: ['b'], b: ['c'], c: [] }), 'a', 'c')).toEqual(
      Option.some(['a', 'b', 'c']),
    )
  })

  test('returns the shortest path when several exist', () => {
    expect(
      Graph.findPath(adjacency({ a: ['b', 'd'], b: ['c'], c: ['d'], d: [] }), 'a', 'd'),
    ).toEqual(Option.some(['a', 'd']))
  })

  test('identical endpoints yield the single-node path', () => {
    expect(Graph.findPath(adjacency({}), 'a', 'a')).toEqual(Option.some(['a']))
  })

  test('returns none when the target is unreachable', () => {
    expect(Graph.findPath(adjacency({ a: ['b'], b: [], c: [] }), 'a', 'c')).toEqual(Option.none())
  })

  test('terminates on cycles', () => {
    expect(Graph.findPath(adjacency({ a: ['b'], b: ['a'] }), 'a', 'c')).toEqual(Option.none())
  })

  Test.property(
    'a returned path actually connects from to to through edges',
    arbAdjacency,
    arbNode,
    arbNode,
    (graph, from, to) => {
      const result = Graph.findPath(graph, from, to)
      if (Option.isNone(result)) return
      const path = result.value
      expect(path[0]).toBe(from)
      expect(path[path.length - 1]).toBe(to)
      for (let i = 0; i < path.length - 1; i++) {
        expect(graph.get(path[i]!) ?? []).toContain(path[i + 1]!)
      }
    },
  )

  Test.property(
    'findPath and transitiveClosure agree on reachability',
    arbAdjacency,
    arbNode,
    arbNode,
    (graph, from, to) => {
      const path = Graph.findPath(graph, from, to)
      const closure = Graph.transitiveClosure(graph, [from])
      expect(Option.isSome(path)).toBe(closure.has(to))
    },
  )
})
