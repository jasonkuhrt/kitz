import { Graph } from '#graph'
import { Test } from '@kitz/test'
import { describe, expect, test } from 'bun:test'
import { Result } from 'effect'
import * as fc from 'fast-check'

const adjacency = (
  entries: Record<string, readonly string[]>,
): ReadonlyMap<string, readonly string[]> => new Map(Object.entries(entries))

const expectLayers = (input: Record<string, readonly string[]>): readonly (readonly string[])[] => {
  const result = Graph.topologicalLayers(adjacency(input))
  if (Result.isFailure(result)) throw new Error(`expected success, got: ${result.failure.message}`)
  return result.success
}

const expectCycle = (input: Record<string, readonly string[]>): Graph.Errors.CycleError => {
  const result = Graph.topologicalLayers(adjacency(input))
  if (Result.isSuccess(result)) throw new Error('expected failure, got success')
  return result.failure
}

describe('Graph.topologicalLayers', () => {
  test('empty graph yields no layers', () => {
    expect(expectLayers({})).toEqual([])
  })

  test('linear chain yields one layer per node', () => {
    expect(expectLayers({ a: [], b: ['a'], c: ['b'] })).toEqual([['a'], ['b'], ['c']])
  })

  test('diamond groups independent middle nodes into one layer', () => {
    expect(expectLayers({ a: [], b: ['a'], c: ['a'], d: ['b', 'c'] })).toEqual([
      ['a'],
      ['b', 'c'],
      ['d'],
    ])
  })

  test('independent nodes share a single layer in insertion order', () => {
    expect(expectLayers({ c: [], a: [], b: [] })).toEqual([['c', 'a', 'b']])
  })

  test('self-cycle is a typed failure carrying the cycle node and edge', () => {
    const error = expectCycle({ a: ['a'] })
    expect(error).toBeInstanceOf(Graph.Errors.CycleError)
    expect(error._tag).toBe('GraphCycleError')
    expect(error.tags).toEqual(['kit', 'graph'])
    expect(error.context.nodes).toEqual(['a'])
    expect(error.context.edges).toEqual([['a', 'a']])
    expect(error.message).toBe('Cycle detected in graph among a: a -> a')
  })

  test('2-cycle reports both members and both edges', () => {
    const error = expectCycle({ a: ['b'], b: ['a'] })
    expect(error.context.nodes).toEqual(['a', 'b'])
    expect(error.context.edges).toEqual([
      ['a', 'b'],
      ['b', 'a'],
    ])
    expect(error.message).toBe('Cycle detected in graph among a, b: a -> b; b -> a')
  })

  test('larger cycle reports every member', () => {
    const error = expectCycle({ a: ['c'], b: ['a'], c: ['b'] })
    expect(error.context.nodes).toEqual(['a', 'b', 'c'])
    expect(error.context.edges).toEqual([
      ['a', 'c'],
      ['b', 'a'],
      ['c', 'b'],
    ])
  })

  test('nodes blocked downstream of a cycle are excluded from the report', () => {
    const error = expectCycle({ a: ['b'], b: ['a'], d: ['a'] })
    expect(error.context.nodes).toEqual(['a', 'b'])
    expect(error.context.edges).toEqual([
      ['a', 'b'],
      ['b', 'a'],
    ])
  })

  test('layers before a cycle still complete; only the stalled set is reported', () => {
    const error = expectCycle({ root: [], a: ['root', 'b'], b: ['a'] })
    expect(error.context.nodes).toEqual(['a', 'b'])
    expect(error.context.edges).toEqual([
      ['a', 'b'],
      ['b', 'a'],
    ])
  })

  test('unknown dependency stalls and is reported without edges', () => {
    const error = expectCycle({ x: ['ghost'] })
    expect(error.context.nodes).toEqual(['x'])
    expect(error.context.edges).toEqual([])
    expect(error.message).toBe('Cycle detected in graph among x')
  })
})

// Generate acyclic graphs: node n{i} may only depend on nodes with lower
// indexes, so cycles are impossible by construction.
const arbAcyclicDependencies = fc
  .integer({ min: 1, max: 12 })
  .chain((size) =>
    fc.tuple(
      ...Array.from({ length: size }, (_, i) =>
        i === 0 ? fc.constant<number[]>([]) : fc.uniqueArray(fc.integer({ min: 0, max: i - 1 })),
      ),
    ),
  )
  .map(
    (dependencyIndexes) =>
      new Map(dependencyIndexes.map((deps, i) => [`n${i}`, deps.map((dep) => `n${dep}`)] as const)),
  )

Test.property(
  'acyclic graphs layer every node exactly once, after all its dependencies',
  arbAcyclicDependencies,
  (dependencies) => {
    const result = Graph.topologicalLayers(dependencies)
    expect(Result.isSuccess(result)).toBe(true)
    if (!Result.isSuccess(result)) return

    const layers = result.success
    const layerIndexOf = new Map<string, number>()
    layers.forEach((layer, index) => {
      for (const node of layer) {
        expect(layerIndexOf.has(node)).toBe(false)
        layerIndexOf.set(node, index)
      }
    })

    expect([...layerIndexOf.keys()].toSorted()).toEqual([...dependencies.keys()].toSorted())

    for (const [node, deps] of dependencies) {
      for (const dep of deps) {
        expect(layerIndexOf.get(node)!).toBeGreaterThan(layerIndexOf.get(dep)!)
      }
    }
  },
)
