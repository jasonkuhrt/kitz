import assert from 'node:assert'
import { Assert } from '@kitz/assert'
import { Test } from '@kitz/test'
import { Schema as S } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  clearExceptTag,
  extractFields,
  type HasRequiredFields,
  hasRequiredFields,
  isTagged,
  pickLiteral1Fields,
  pickLiteral1FieldsAsLiterals,
  getValueAtField,
} from './struct.js'

const A = Assert.Type.exact.ofAs

// ============================================================================
// Runtime Tests
// ============================================================================

Test.describe('hasRequiredFields')
  .on(hasRequiredFields)
  .cases(
    // Required: plain Schema.String (not optional)
    [[S.Struct({ apiKey: S.String })], true, { comment: 'required String field' }],
    [[S.Struct({ port: S.Number })], true, { comment: 'required Number field' }],
    // Optional: Schema.optional (no default)
    [[S.Struct({ name: S.optional(S.String) })], false, { comment: 'optional field' }],
    // Optional: Schema.optional with default
    [
      [S.Struct({ port: S.Number.pipe(S.withDecodingDefaultKey(() => 3000)) })],
      false,
      {
        comment: 'optionalWith default',
      },
    ],
    // Mixed: has both optional and required
    [
      [
        S.Struct({
          apiKey: S.String, // required
          port: S.Number.pipe(S.withDecodingDefaultKey(() => 3000)), // optional
        }),
      ],
      true,
      { comment: 'mixed optional and required' },
    ],
    // All optional with defaults
    [
      [
        S.Struct({
          trunk: S.String.pipe(S.withDecodingDefaultKey(() => 'main')),
          port: S.Number.pipe(S.withDecodingDefaultKey(() => 8080)),
        }),
      ],
      false,
      { comment: 'all optionalWith defaults' },
    ],
    // Empty struct
    [[S.Struct({})], false, { comment: 'empty struct' }],
    // Optional with nullable
    [
      [
        S.Struct({
          name: S.optional(S.NullOr(S.String)),
        }),
      ],
      false,
      { comment: 'optional nullable' },
    ],
    // Optional with exact
    [
      [
        S.Struct({
          name: S.optionalKey(S.String),
        }),
      ],
      false,
      { comment: 'optional exact' },
    ],
  )
  .test()

// Schema.Class tests
Test.describe('hasRequiredFields > Schema.Class')
  .on(hasRequiredFields)
  .cases(
    // Schema.Class with required field
    [
      [class extends S.Class<any>('Config')({ apiKey: S.String }) {}],
      true,
      { comment: 'Class required' },
    ],
    // Schema.Class with all optional defaults
    [
      [
        class extends S.Class<any>('Config')({
          trunk: S.String.pipe(S.withDecodingDefaultKey(() => 'main')),
        }) {},
      ],
      false,
      { comment: 'Class all optional' },
    ],
    // Schema.Class mixed
    [
      [
        class extends S.Class<any>('Config')({
          apiKey: S.String,
          port: S.Number.pipe(S.withDecodingDefaultKey(() => 3000)),
        }) {},
      ],
      true,
      { comment: 'Class mixed' },
    ],
  )
  .test()

// ============================================================================
// Type-Level Tests
// ============================================================================

// Required field → true
const _reqSchema = S.Struct({ apiKey: S.String })
type _reqString = Assert.exact.of<HasRequiredFields<typeof _reqSchema>, true>

// All optional → false
const _optSchema = S.Struct({ port: S.Number.pipe(S.withDecodingDefaultKey(() => 3000)) })
type _optAll = Assert.exact.of<HasRequiredFields<typeof _optSchema>, false>

// Empty struct → false
const _emptySchema = S.Struct({})
type _empty = Assert.exact.of<HasRequiredFields<typeof _emptySchema>, false>

// Type assertion for runtime values
Test.describe('HasRequiredFields runtime').test(() => {
  // Required
  const reqSchema = S.Struct({ apiKey: S.String })
  assert.equal(hasRequiredFields(reqSchema), true)

  // Optional with default
  const optSchema = S.Struct({
    port: S.Number.pipe(S.withDecodingDefaultKey(() => 3000)),
  })
  assert.equal(hasRequiredFields(optSchema), false)

  // Empty
  const emptySchema = S.Struct({})
  assert.equal(hasRequiredFields(emptySchema), false)
})

describe('struct helpers', () => {
  const Config = S.Struct({
    _tag: S.Literal('Config'),
    mode: S.Literal('prod'),
    retries: S.Number,
    label: S.String,
  })

  test('isTagged and clearExceptTag operate on tagged objects', () => {
    const tagged = {
      _tag: 'Config',
      mode: 'prod',
      retries: 3,
    }

    expect(isTagged(tagged)).toBe(true)
    expect(isTagged(null)).toBe(false)
    expect(isTagged('Config')).toBe(false)

    clearExceptTag(tagged)

    expect(tagged).toEqual({ _tag: 'Config' })
  })

  test('extractFields selects a schema field subset', () => {
    const extracted = extractFields(Config, ['mode', 'retries'] as const)

    expect(Object.keys(extracted)).toEqual(['mode', 'retries'])
    expect(extracted.mode).toBe(Config.fields.mode)
    expect(extracted.retries).toBe(Config.fields.retries)
  })

  test('pickLiteral1Fields and getValueAtField expose literal schema metadata', () => {
    expect(pickLiteral1FieldsAsLiterals(Config)).toEqual({
      mode: 'prod',
    })
    expect(Object.keys(pickLiteral1Fields(Config))).toEqual(['_tag', 'mode'])
    expect(getValueAtField(Config, 'mode')).toBe('prod')
    expect(() => getValueAtField(Config, 'label')).toThrow('not a literal')
  })
})
