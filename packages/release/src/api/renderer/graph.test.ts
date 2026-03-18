import { describe, expect, test } from 'vitest'
import { renderGraph } from './graph.js'

const makeReadonlyMap = <A>(
  entries: ReadonlyArray<readonly [string, A]>,
): ReadonlyMap<string, A> => {
  const record: Partial<Record<string, A>> = Object.fromEntries(entries)
  const iterator = function* (): Generator<[string, A], undefined, unknown> {
    for (const [key, value] of entries) {
      yield [key, value]
    }
    return undefined
  }

  const map = {
    get: (key: string) => record[key],
    has: (key: string) => key in record,
    forEach: (callbackfn) => {
      for (const [key, value] of entries) {
        callbackfn(value, key, map)
      }
    },
    entries: iterator,
    keys: function* (): Generator<string, undefined, unknown> {
      for (const [key] of entries) {
        yield key
      }
      return undefined
    },
    values: function* (): Generator<A, undefined, unknown> {
      for (const [, value] of entries) {
        yield value
      }
      return undefined
    },
    [Symbol.iterator]: iterator,
    get size() {
      return entries.length
    },
  } satisfies ReadonlyMap<string, A>

  return map
}

describe('renderGraph', () => {
  test('renders layers and dependency edges', () => {
    const map = makeReadonlyMap([
      ['Prepare:@kitz/core', { dependencies: [] }],
      ['Publish:@kitz/core', { dependencies: ['Prepare:@kitz/core'] }],
      ['CreateTag:@kitz/core@1.1.0', { dependencies: ['Publish:@kitz/core'] }],
    ] as const)

    const output = renderGraph({
      layers: [['Prepare:@kitz/core'], ['Publish:@kitz/core'], ['CreateTag:@kitz/core@1.1.0']],
      nodes: map,
    })

    expect(output).toContain('release graph')
    expect(output).toContain('layer 1 (1)')
    expect(output).toContain('Prepare:@kitz/core')
    expect(output).toContain('Publish:@kitz/core ← Prepare:@kitz/core')
    expect(output).toContain('CreateTag:@kitz/core@1.1.0 ← Publish:@kitz/core')
  })
})
