import { Graph } from '#graph'
import { Test } from '@kitz/test'
import { describe, expect, test } from 'bun:test'
import * as fc from 'fast-check'

const adjacency = (
  entries: Record<string, readonly string[]>,
): ReadonlyMap<string, readonly string[]> => new Map(Object.entries(entries))

const arbNode = fc.integer({ min: 0, max: 7 }).map((n) => `n${n}`)
const arbAdjacency = fc
  .array(fc.tuple(arbNode, fc.array(arbNode, { maxLength: 4 })), { maxLength: 12 })
  .map((entries) => new Map(entries) as ReadonlyMap<string, readonly string[]>)
const arbSeeds = fc.array(arbNode, { maxLength: 4 })

describe('Graph.transitiveClosure', () => {
  test('no seeds yields an empty closure', () => {
    expect(Graph.transitiveClosure(adjacency({ a: ['b'], b: [] }), [])).toEqual(new Set())
  })

  test('seeds with no edges yield only the seeds', () => {
    expect(Graph.transitiveClosure(adjacency({ a: [], b: [] }), ['a'])).toEqual(new Set(['a']))
  })

  test('follows chains transitively', () => {
    expect(Graph.transitiveClosure(adjacency({ a: ['b'], b: ['c'], c: [], d: [] }), ['a'])).toEqual(
      new Set(['a', 'b', 'c']),
    )
  })

  test('merges reachability from multiple seeds', () => {
    expect(
      Graph.transitiveClosure(adjacency({ a: ['b'], b: [], c: ['d'], d: [], e: [] }), ['a', 'c']),
    ).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  test('terminates on cycles and includes every cycle member once', () => {
    expect(Graph.transitiveClosure(adjacency({ a: ['b'], b: ['a'] }), ['a'])).toEqual(
      new Set(['a', 'b']),
    )
  })

  test('seeds absent from the adjacency map are kept but not expanded', () => {
    expect(Graph.transitiveClosure(adjacency({ a: ['b'], b: [] }), ['zz'])).toEqual(new Set(['zz']))
  })

  test('preserves discovery order: seeds first, then breadth-first', () => {
    const closure = Graph.transitiveClosure(
      adjacency({ a: ['c', 'd'], b: ['e'], c: [], d: [], e: [] }),
      ['a', 'b'],
    )
    expect([...closure]).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  Test.property('closure contains its seeds', arbAdjacency, arbSeeds, (graph, seeds) => {
    const closure = Graph.transitiveClosure(graph, seeds)
    expect(seeds.every((seed) => closure.has(seed))).toBe(true)
  })

  Test.property('closure is idempotent', arbAdjacency, arbSeeds, (graph, seeds) => {
    const once = Graph.transitiveClosure(graph, seeds)
    const twice = Graph.transitiveClosure(graph, once)
    expect([...twice].toSorted()).toEqual([...once].toSorted())
  })

  Test.property(
    'every non-seed member is reachable through an edge from another member',
    arbAdjacency,
    arbSeeds,
    (graph, seeds) => {
      const closure = Graph.transitiveClosure(graph, seeds)
      const seedSet = new Set(seeds)
      for (const node of closure) {
        if (seedSet.has(node)) continue
        const reachable = [...closure].some((member) => (graph.get(member) ?? []).includes(node))
        expect(reachable).toBe(true)
      }
    },
  )
})
