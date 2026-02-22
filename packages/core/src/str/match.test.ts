import { Assert } from '#kitz/assert'
import { Str } from '#str'
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { match, matchAll, pattern, patternWith, type RegexMatch } from './match.js'
import { replace, replaceAll } from './replace.js'

const A = Assert.Type

// NOTE: Some type assertions below use `${string}${bigint}${string}${string}` due to an arkregex bug
// where the + quantifier incorrectly appends ${string} to inferred types.
// Tracking: https://github.com/arktypeio/arktype/issues/1563

// ============================================================================
// Pattern Tests
// ============================================================================

describe('pattern', () => {
  test('creates regex from string', () => {
    const p = pattern('\\w+')
    A.exact.ofAs<Str.Regex<string, {}>>().on(p)
    expect(p).toBeInstanceOf(RegExp)
  })

  test('preserves flags at type level', () => {
    const p = pattern('^\\d$', 'gi')
    // Note: arkregex infers ${number} for \d pattern (see arkregex bug note at top)
    A.exact.ofAs<Str.Regex<`${number}`, { flags: 'gi' }>>().on(p)
  })
})

describe('pattern.as', () => {
  test('manual typing for string', () => {
    const p = pattern.as<string, { names: { id: string } }>('(?<id>\\w+)')
    A.exact.ofAs<Str.Regex<string, { names: { id: string } }>>().on(p)
  })

  test('manual typing for RegExp', () => {
    const external = /(?<user>\w+)/
    const typed = pattern.as<string, { names: { user: string } }>(external)
    A.exact.ofAs<Str.Regex<string, { names: { user: string } }>>().on(typed)
  })
})

describe('patternWith', () => {
  test('curried pattern creation', () => {
    const withGlobal = patternWith('g')
    const p = withGlobal('\\d+')
    A.exact.ofAs<Str.Regex<'\\d+', { flags: 'g' }>>().on(p)
    expect(p.flags).toBe('g')
  })
})

// ============================================================================
// Match Tests
// ============================================================================

describe('match', () => {
  test('returns Option.some with RegexMatch on match', () => {
    const p = pattern('\\d+')
    const result = match('a1b', p)
    A.exact.ofAs<Option.Option<RegexMatch<typeof p>>>().on(result)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.value).toBe('1')
      expect(result.value.offset).toBe(1)
      expect(result.value.input).toBe('a1b')
    }
  })

  test('returns Option.none on no match', () => {
    const p = pattern('\\d+')
    const result = match('hello', p)
    A.exact.ofAs<Option.Option<RegexMatch<typeof p>>>().on(result)
    expect(Option.isNone(result)).toBe(true)
  })

  test('string pattern does exact match', () => {
    const result = match('hello', 'hello')
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.value).toBe('hello')
      expect(result.value.offset).toBe(0)
    }
    expect(Option.isNone(match('hello world', 'hello'))).toBe(true)
  })

  test('captures positional groups', () => {
    const p = pattern('(\\w+)@(\\w+)')
    const result = match('user@example', p)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.value).toBe('user@example')
      expect(result.value.captures).toEqual(['user', 'example'])
    }
  })

  test('captures named groups', () => {
    const p = pattern('(?<user>\\w+)@(?<domain>\\w+)')
    const result = match('john@test', p)
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) {
      expect(result.value.groups).toEqual({ user: 'john', domain: 'test' })
    }
  })
})

describe('matchAll', () => {
  test('returns iterator', () => {
    const p = pattern('\\d+', 'g')
    const result = matchAll('a1 b2 c3', p)
    A.exact.ofAs<IterableIterator<RegExpExecArray>>().on(result)
    expect(Array.from(result)).toHaveLength(3)
  })
})

describe('isMatch', () => {
  test('returns boolean', () => {
    A.exact.ofAs<boolean>().on(Str.isMatch('hello', /hello/))
    A.exact.ofAs<boolean>().on(Str.isMatch('hello', 'hello'))
    A.exact.ofAs<boolean>().on(Str.isMatch('hello', pattern('hello')))
  })
})

// ============================================================================
// Replace Tests
// ============================================================================

describe('replace', () => {
  test('replaces first occurrence', () => {
    const result = replace('a1 b2 c3', pattern('\\d+'), 'X')
    A.exact.ofAs<string>().on(result)
    expect(result).toBe('aX b2 c3')
  })

  test('accepts callback with RegexMatch', () => {
    const p = pattern('\\d+')
    const result = replace('a1 b2', p, (m) => {
      A.exact.ofAs<{
        value: `${number}` // arkregex infers ${number} for \d+ pattern
        offset: number
        captures: []
        groups: {}
        input: string
      }>().on(m)
      return `[${m.value}]`
    })
    A.exact.ofAs<string>().on(result)
    expect(result).toBe('a[1] b2')
  })
})

describe('replaceAll', () => {
  test('error if given regex pattern is not global', () => {
    const nonGlobal = pattern('\\d+') // No 'g' flag
    // Type-only test: @ts-expect-error verifies non-global pattern causes type error
    // @ts-expect-error - non-global pattern should produce type error
    const _typeCheck: Parameters<typeof replaceAll>[1] = nonGlobal
  })

  test('replaces all occurrences', () => {
    const result = replaceAll('a1 b2 c3', pattern('\\d+', 'g'), 'X')
    A.exact.ofAs<string>().on(result)
    expect(result).toBe('aX bX cX')
  })

  test('accepts callback with RegexMatch', () => {
    const p = pattern('\\d+', 'g')
    const result = replaceAll('a1 b2 c3', p, (m) => {
      A.exact.ofAs<{
        value: `${number}` // arkregex infers ${number} for \d+ pattern
        offset: number
        captures: []
        groups: {}
        input: string
      }>().on(m)
      return `[${m.value}]`
    })
    A.exact.ofAs<string>().on(result)
    expect(result).toBe('a[1] b[2] c[3]')
  })
})
