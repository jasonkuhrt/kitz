import { Schema } from 'effect'
import { describe, expect, test } from 'bun:test'
import * as JsonModule from './_.js'
import {
  canonicalize,
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

describe('canonicalize (RFC 8785 JCS)', () => {
  // Reference vectors are the published RFC 8785 conformance suite
  // (cyberphone/json-canonicalization `testdata`), embedded byte-for-byte as
  // pure-ASCII \u escapes so every non-printable / combining code point stays
  // reviewable and the expectations cannot drift on copy/paste.

  test('reference vector: values (number serialization, string escaping, key order)', () => {
    const input = fromString(
      '{\u000a  "numbers": [333333333.33333329, 1E30, 4.50, 2e-3, 0.000000000000000000000000001],\u000a  "string": "\\u20ac$\\u000F\\u000aA\'\\u0042\\u0022\\u005c\\\\\\"\\/",\u000a  "literals": [null, true, false]\u000a}',
    )
    expect(canonicalize(input)).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"\u20ac$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}',
    )
  })

  test('reference vector: french (locale-independent key order)', () => {
    const input = fromString(
      '{\u000a  "peach": "This sorting order",\u000a  "p\u00e9ch\u00e9": "is wrong according to French",\u000a  "p\u00eache": "but canonicalization MUST",\u000a  "sin":   "ignore locale"\u000a}\u000a',
    )
    expect(canonicalize(input)).toBe(
      '{"peach":"This sorting order","p\u00e9ch\u00e9":"is wrong according to French","p\u00eache":"but canonicalization MUST","sin":"ignore locale"}',
    )
  })

  test('reference vector: weird (UTF-16 code-unit order + control escaping)', () => {
    const input = fromString(
      '{\u000a  "\\u20ac": "Euro Sign",\u000a  "\\r": "Carriage Return",\u000a  "\\u000a": "Newline",\u000a  "1": "One",\u000a  "\\u0080": "Control\\u007f",\u000a  "\\ud83d\\ude02": "Smiley",\u000a  "\\u00f6": "Latin Small Letter O With Diaeresis",\u000a  "\\ufb33": "Hebrew Letter Dalet With Dagesh",\u000a  "</script>": "Browser Challenge"\u000a}\u000a',
    )
    expect(canonicalize(input)).toBe(
      '{"\\n":"Newline","\\r":"Carriage Return","1":"One","</script>":"Browser Challenge","\u0080":"Control\u007f","\u00f6":"Latin Small Letter O With Diaeresis","\u20ac":"Euro Sign","\ud83d\ude02":"Smiley","\ufb33":"Hebrew Letter Dalet With Dagesh"}',
    )
  })

  test('reference vector: unicode (keys/values are NOT NFC-normalized)', () => {
    const input = fromString('{\u000a  "Unnormalized Unicode":"A\\u030a"\u000a}\u000a')
    expect(canonicalize(input)).toBe('{"Unnormalized Unicode":"A\u030a"}')
  })

  test('digest({a,b}) === digest({b,a}) — output is independent of key order', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }))
    expect(canonicalize({ a: 1, b: 2 })).toBe('{"a":1,"b":2}')
    const forward = { x: 1, y: 2, z: 3, nested: { p: 1, q: 2 } }
    const reverse = { nested: { q: 2, p: 1 }, z: 3, y: 2, x: 1 }
    expect(canonicalize(forward)).toBe(canonicalize(reverse))
  })

  test('orders keys by UTF-16 code units, not locale collation', () => {
    // localeCompare in many locales orders case-insensitively ('a' before 'Z')
    // and files accented letters next to their base. Code-unit order is strict:
    // 'Z'(U+005A) < 'a'(U+0061); 'z'(U+007A) < U+00E4 (a-umlaut, '\u00e4').
    expect(canonicalize({ a: 1, Z: 2 })).toBe('{"Z":2,"a":1}')
    expect(canonicalize({ z: 1, ['\u00e4']: 2 })).toBe('{"z":1,"\u00e4":2}')
  })

  test('orders keys by UTF-16 code units, not Unicode code points (surrogate pairs)', () => {
    // U+1F602 has UTF-16 lead unit U+D83D; U+FB33 is a single unit.
    // Code-unit order: D83D < FB33 -> the supplementary code point sorts first.
    // Code-point order (1F602 > FB33) would reverse them.
    expect(canonicalize({ ['\ufb33']: 1, ['\ud83d\ude02']: 2 })).toBe(
      '{"\ud83d\ude02":2,"\ufb33":1}',
    )
  })

  test('does not NFC-normalize keys (decomposed and precomposed stay distinct)', () => {
    const nfc = '\u00e9' // precomposed e-acute (single code point)
    const nfd = 'e\u0301' // decomposed (e + combining acute accent)
    // Both distinct keys survive as two members; NFC normalization would
    // collide them into one. Code-unit order puts the decomposed form first
    // ('e' = U+0065 < U+00E9).
    expect(canonicalize({ [nfc]: 1, [nfd]: 2 })).toBe('{"e\u0301":2,"\u00e9":1}')
    expect(canonicalize({ [nfc]: 0 })).not.toBe(canonicalize({ [nfd]: 0 }))
  })

  test('serializes numbers per RFC 8785 (ECMAScript Number::toString)', () => {
    expect(canonicalize(1e30)).toBe('1e+30')
    expect(canonicalize(1e-27)).toBe('1e-27')
    expect(canonicalize(0.002)).toBe('0.002')
    expect(canonicalize(4.5)).toBe('4.5')
    expect(canonicalize(100)).toBe('100')
    expect(canonicalize(-0)).toBe('0') // negative zero normalized to 0
    expect(canonicalize([1, 2.5, -3])).toBe('[1,2.5,-3]')
  })

  test('rejects values that are not representable JSON', () => {
    expect(() => canonicalize(Number.NaN)).toThrow()
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow()
    expect(() => canonicalize(Number.NEGATIVE_INFINITY)).toThrow()
    expect(() => canonicalize(1n)).toThrow() // bigint is not JSON
    expect(() => canonicalize(undefined)).toThrow()
  })

  test('escapes strings with short escapes and lowercase \\u for other controls', () => {
    expect(canonicalize('\b\t\n\f\r')).toBe('"\\b\\t\\n\\f\\r"')
    expect(canonicalize('\u0000\u0001\u001f')).toBe('"\\u0000\\u0001\\u001f"')
    expect(canonicalize('"\\')).toBe('"\\"\\\\"')
    expect(canonicalize('/')).toBe('"/"') // forward slash is NOT escaped
  })

  test('drops undefined-valued keys and renders array holes as null', () => {
    expect(canonicalize({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}')
    expect(canonicalize([1, undefined, 3])).toBe('[1,null,3]')
    expect(canonicalize({ a: 1, f: () => 1 })).toBe('{"a":1}')
  })

  test('renders sparse-array holes as null (never an invalid `,,`)', () => {
    // A true hole (not an explicit `undefined`): `.map` would skip it and emit
    // `[1,,3]`, which is not valid JSON. JSON.stringify renders holes as null.
    const sparse = [1]
    sparse[2] = 3
    expect(canonicalize(sparse)).toBe('[1,null,3]')
    expect(canonicalize(sparse)).toBe(JSON.stringify(sparse))
  })

  test('honors toJSON (e.g. Date) like JSON.stringify', () => {
    expect(canonicalize({ at: new Date(0) })).toBe('{"at":"1970-01-01T00:00:00.000Z"}')
  })

  test('forwards the member key to toJSON, like JSON.stringify', () => {
    const probe = { toJSON: (key: string) => key }
    expect(canonicalize({ at: probe })).toBe('{"at":"at"}')
    expect(canonicalize([probe])).toBe('["0"]') // array index is the key
  })

  test('canonicalize is reachable through the Json namespace', () => {
    expect(JsonModule.Json.canonicalize).toBe(canonicalize)
  })
})
