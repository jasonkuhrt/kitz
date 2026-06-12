import { Str } from '#str'
import { Test } from '@kitz/test'
import * as fc from 'fast-check'
import { describe, expect, test } from 'bun:test'

const { added, diff, kept, lines, removed, toUnifiedLines } = Str.Diff

// ============================================================================
// Arbitraries
// ============================================================================

/**
 * Texts that stress the diff: explicit multi-line structure (lines joined
 * with LF) plus completely arbitrary code-point strings (which may contain
 * any mix of line endings, or none).
 */
const arbText = fc.oneof(
  fc.array(fc.string({ maxLength: 8 }), { maxLength: 20 }).map((textLines) => textLines.join('\n')),
  fc.string({ unit: 'binary', maxLength: 60 }),
)

// ============================================================================
// Properties
// ============================================================================

Test.property('diff(a, a) yields only kept lines equal to the lines of a', arbText, (text) => {
  const result = diff(text, text)
  expect(result.every((line) => line._tag === 'LineKept')).toBe(true)
  expect(result.map((line) => line.text)).toEqual([...lines(text)])
})

Test.property(
  'reconstruction: kept+removed == before lines, kept+added == after lines',
  arbText,
  arbText,
  (before, after) => {
    const result = diff(before, after)
    const beforeReconstructed = result
      .filter((line) => line._tag !== 'LineAdded')
      .map((line) => line.text)
    const afterReconstructed = result
      .filter((line) => line._tag !== 'LineRemoved')
      .map((line) => line.text)
    expect(beforeReconstructed).toEqual([...lines(before)])
    expect(afterReconstructed).toEqual([...lines(after)])
  },
)

Test.property(
  'diff never throws on arbitrary strings',
  fc.string({ unit: 'binary', maxLength: 200 }),
  fc.string({ unit: 'binary', maxLength: 200 }),
  (before, after) => {
    expect(() => diff(before, after)).not.toThrow()
  },
)

Test.property(
  'toUnifiedLines agrees with diff: one rendered line per diff line, prefix matches tag',
  arbText,
  arbText,
  (before, after) => {
    const result = diff(before, after)
    const unified = toUnifiedLines(result)
    expect(unified.length).toBe(result.length)
    for (const [index, line] of result.entries()) {
      const prefix = line._tag === 'LineKept' ? ' ' : line._tag === 'LineAdded' ? '+' : '-'
      expect(unified[index]).toBe(`${prefix}${line.text}`)
    }
  },
)

// ============================================================================
// Examples
// ============================================================================

describe('lines', () => {
  test('empty string is zero lines', () => {
    expect(lines('')).toEqual([])
  })

  test('trailing newline produces a final empty line', () => {
    expect(lines('a\n')).toEqual(['a', ''])
  })

  test('splits on LF, CRLF, and CR', () => {
    expect(lines('a\nb\r\nc\rd')).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('diff', () => {
  test('identical texts are all kept', () => {
    expect(diff('a\nb', 'a\nb')).toEqual([kept('a'), kept('b')])
  })

  test('single-line change', () => {
    expect(diff('a\nb\nc', 'a\nx\nc')).toEqual([kept('a'), removed('b'), added('x'), kept('c')])
  })

  test('insertion', () => {
    expect(diff('a\nc', 'a\nb\nc')).toEqual([kept('a'), added('b'), kept('c')])
  })

  test('deletion', () => {
    expect(diff('a\nb\nc', 'a\nc')).toEqual([kept('a'), removed('b'), kept('c')])
  })

  test('empty before: every line added', () => {
    expect(diff('', 'a\nb')).toEqual([added('a'), added('b')])
  })

  test('empty after: every line removed', () => {
    expect(diff('a\nb', '')).toEqual([removed('a'), removed('b')])
  })

  test('both empty: empty diff', () => {
    expect(diff('', '')).toEqual([])
  })

  test('added trailing newline surfaces as an added empty line', () => {
    expect(diff('a', 'a\n')).toEqual([kept('a'), added('')])
  })

  test('removed trailing newline surfaces as a removed empty line', () => {
    expect(diff('a\n', 'a')).toEqual([kept('a'), removed('')])
  })

  test('CRLF and LF line endings compare equal', () => {
    expect(diff('a\r\nb', 'a\nb')).toEqual([kept('a'), kept('b')])
  })

  test('removals are emitted before the additions that replace them', () => {
    expect(diff('a\nb', 'x\ny')).toEqual([removed('a'), removed('b'), added('x'), added('y')])
  })

  test('one-byte change in a large text only touches the changed line', () => {
    const before = Array.from({ length: 50 }, (_, index) => `line ${index}`).join('\n')
    const after = before.replace('line 25', 'line 25!')
    const result = diff(before, after)
    expect(result.filter((line) => line._tag !== 'LineKept')).toEqual([
      removed('line 25'),
      added('line 25!'),
    ])
    expect(result.filter((line) => line._tag === 'LineKept')).toHaveLength(49)
  })
})

describe('toUnifiedLines', () => {
  test('renders space, minus, and plus prefixes', () => {
    expect(toUnifiedLines(diff('a\nb', 'a\nc'))).toEqual([' a', '-b', '+c'])
  })

  test('empty diff renders no lines', () => {
    expect(toUnifiedLines(diff('', ''))).toEqual([])
  })
})
