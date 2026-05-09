import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as Core from '../core.js'
import * as DagCompact from './dag-compact.js'
import * as List from './list.js'

const fixedTime = new Date('2024-01-01T00:00:00.000Z').getTime()
const RealDate = globalThis.Date

beforeEach(() => {
  globalThis.Date = class extends RealDate {
    constructor(...args: ConstructorParameters<typeof RealDate> | []) {
      if (args.length === 0) {
        super(fixedTime)
      } else {
        super(...(args as ConstructorParameters<typeof RealDate>))
      }
    }
    static override now() {
      return fixedTime
    }
  } as DateConstructor
})

afterEach(() => {
  globalThis.Date = RealDate
})

describe('Flo.Viz renderers', () => {
  test('list renderer falls back to pending for unknown activity names', () => {
    const output = List.render(['Unknown'], Core.createState([]), false)

    expect(output).toContain('Unknown')
    expect(output).toContain('0/0 completed')
  })

  test('compact DAG renderer skips sparse layers and falls back to pending nodes', () => {
    const layers: Array<readonly string[] | undefined> = []
    layers[0] = ['Solo']
    layers[2] = ['Left', 'Right']

    const output = DagCompact.render(
      layers as unknown as readonly (readonly string[])[],
      [],
      Core.createState([]),
      false,
    )

    expect(output).toContain('Layer 0:')
    expect(output).toContain('Layer 2:')
    expect(output).not.toContain('Layer 1:')
    expect(output).toContain('Solo')
    expect(output).toContain('Left')
    expect(output).toContain('Right')
  })
})
