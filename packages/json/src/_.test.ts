import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import * as JsonModule from './_.js'
import {
  fromString,
  is,
  isObject,
  isPrimitive,
  ObjectSchema,
  PrimitiveSchema,
  Schema as JsonSchema,
  toString,
  ValueSchema,
} from './json.js'

describe('json', () => {
  test('exports the Json namespace', () => {
    expect(JsonModule.Json.Schema).toBe(JsonSchema)
    expect(JsonModule.Json.fromString).toBe(fromString)
    expect(JsonModule.Json.toString).toBe(toString)
  })

  test('decodes and encodes JSON values', () => {
    const decoded = fromString('{"name":"kitz","flags":[true, null, 1]}')
    const encoded = toString(decoded)

    expect(decoded).toEqual({ name: 'kitz', flags: [true, null, 1] })
    expect(encoded).toBe('{"name":"kitz","flags":[true,null,1]}')
    expect(toString(['kitz', 1, true, null])).toBe('["kitz",1,true,null]')
    expect(Schema.decodeSync(PrimitiveSchema)(1)).toBe(1)
    expect(Schema.decodeUnknownSync(ValueSchema)(decoded)).toEqual(decoded)
    expect(Schema.decodeUnknownSync(ObjectSchema)({ foo: 'bar' })).toEqual({ foo: 'bar' })
    expect(() => fromString('{')).toThrow()
  })

  test('exposes JSON type guards', () => {
    expect(is({ nested: ['value'] })).toBe(true)
    expect(isPrimitive(null)).toBe(true)
    expect(isPrimitive(Symbol('x'))).toBe(false)
    expect(isObject({ ok: true })).toBe(true)
    expect(isObject(['not-an-object'])).toBe(false)
  })
})
