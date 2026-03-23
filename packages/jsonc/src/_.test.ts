import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import * as JsoncModule from './_.js'
import { parseJsonc } from './jsonc.js'

describe('jsonc', () => {
  test('exports the Jsonc namespace', () => {
    expect(JsoncModule.Jsonc.parseJsonc).toBe(parseJsonc)
  })

  test('parses JSONC documents with comments and trailing commas', () => {
    const decode = Schema.decodeUnknownSync(parseJsonc())

    expect(
      decode(`{
        // comment
        "name": "kitz",
        "ports": [3000, 3001,],
      }`),
    ).toEqual({
      name: 'kitz',
      ports: [3000, 3001],
    })
  })

  test('encodes values and reports parse failures', () => {
    const codec = parseJsonc()

    expect(Schema.encodeSync(codec)({ name: 'kitz' })).toBe('{\n  "name": "kitz"\n}')
    expect(() => Schema.decodeUnknownSync(codec)('{ invalid jsonc')).toThrow(/InvalidSymbol/)
  })

  test('surfaces JSON encoding failures', () => {
    const codec = parseJsonc()
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(() => Schema.encodeSync(codec)(circular)).toThrow(/circular/i)
  })
})
