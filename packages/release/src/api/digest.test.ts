import { Json } from '@kitz/json'
import { Test } from '@kitz/test'
import { describe, expect, test } from 'bun:test'
import * as fc from 'fast-check'
import { arbJsonRecord } from '../test-support.js'
import { canonicalJson, sha256Json } from './digest.js'

describe('release digest', () => {
  test('digest({a,b}) === digest({b,a}) — plan/config/idempotency digests are key-order stable', () => {
    expect(sha256Json({ a: 1, b: 2 }).value).toBe(sha256Json({ b: 2, a: 1 }).value)
    // Deeper, nested structures are stable under reordering too.
    const forward = { name: '@kitz/core', version: '1.0.0', tags: { latest: true, next: false } }
    const reverse = { tags: { next: false, latest: true }, version: '1.0.0', name: '@kitz/core' }
    expect(sha256Json(forward).value).toBe(sha256Json(reverse).value)
  })

  test('orders keys by UTF-16 code unit, not locale collation (no localeCompare hazard)', () => {
    // localeCompare would file 'a' before 'Z' in many locales; code-unit order
    // is strict ('Z' = U+005A < 'a' = U+0061) and identical on every machine.
    expect(canonicalJson({ a: 1, Z: 2 })).toBe('{"Z":2,"a":1}')
    // U+00E4 (a-umlaut) sorts after 'z' (U+007A) by code unit.
    expect(canonicalJson({ z: 1, ['\u00e4']: 2 })).toBe('{"z":1,"\u00e4":2}')
  })

  test('does not Unicode-normalize keys (no NFC rewrite)', () => {
    // Precomposed U+00E9 and decomposed (e + U+0301) are distinct keys; the old
    // key.normalize('NFC') would have collided them and silently changed digests.
    const precomposed = '\u00e9'
    const decomposed = 'e\u0301'
    expect(canonicalJson({ [precomposed]: 1 })).not.toBe(canonicalJson({ [decomposed]: 1 }))
    expect(sha256Json({ [precomposed]: 1 }).value).not.toBe(sha256Json({ [decomposed]: 1 }).value)
  })

  test('composes the @kitz/json RFC 8785 primitive (no release-local algorithm)', () => {
    const value = { numbers: [1e30, 0.002], string: 'caf\u00e9', literals: [null, true] }
    expect(canonicalJson(value)).toBe(Json.canonicalize(value))
  })
})

// \u2500\u2500 Properties \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/** Fisher\u2013Yates shuffle driven entirely by a fast-check seed (no `Math.random`). */
const shuffleBySeed = <T>(values: readonly T[], seed: readonly number[]): T[] => {
  const shuffled = [...values]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (seed[i % seed.length] ?? 0) % (i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  return shuffled
}

Test.property(
  'sha256Json is key-insertion-order invariant for any JSON record',
  arbJsonRecord,
  fc.array(fc.nat(), { maxLength: 16 }),
  (record, seed) => {
    // Object.fromEntries defines own properties, so even a generated
    // "__proto__" key survives the reordering clone intact.
    const clone = Object.fromEntries(
      shuffleBySeed(Object.keys(record), seed).map((key) => [key, record[key]]),
    )

    expect(canonicalJson(clone)).toBe(canonicalJson(record))
    expect(sha256Json(clone).value).toBe(sha256Json(record).value)
  },
)
