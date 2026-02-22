import { Test } from '#kitz/test'
import { expect, test } from 'vitest'
import { Str } from './_.js'

Test.on(Str.Visual.width)
  .casesInput(
    // Plain text
    'hello',
    'abc',
    // ANSI escape codes
    '\x1b[31mred\x1b[0m',
    '\x1b[32mgreen\x1b[0m text',
    '\x1b[1m\x1b[4mbold underline\x1b[0m',
    // Grapheme clusters
    '👋',
    '👨‍👩‍👧‍👦', // Family emoji (multi-codepoint)
    '🇺🇸', // Flag emoji
    'é', // e + combining accent
    // Empty string
    '',
    '\x1b[31m\x1b[0m', // Only ANSI codes
    // Mixed content
    '👋 \x1b[32mhello\x1b[0m', // emoji + space + "hello"
  )
  .test()

// Regression test for issue #41: Ensure width calculation is consistent across environments
// Different Node.js versions have different ICU data, which affects Intl.Segmenter behavior.
// Using explicit locale ('en-US') ensures deterministic grapheme segmentation.
test('width: cross-environment consistency (issue #41)', () => {
  // Basic ASCII - should always be consistent
  expect(Str.Visual.width('Environment (1)')).toBe(15)
  expect(Str.Visual.width('Name')).toBe(4)
  expect(Str.Visual.width('Type')).toBe(4)
  expect(Str.Visual.width('Default')).toBe(7)

  // With ANSI codes - visual width ignores escape codes
  expect(Str.Visual.width('\x1b[32mEnvironment (1)\x1b[0m')).toBe(15)

  // Grapheme clusters - these are sensitive to ICU version
  expect(Str.Visual.width('é')).toBe(1) // e + combining accent
  expect(Str.Visual.width('👨‍👩‍👧‍👦')).toBe(1) // Family emoji
  expect(Str.Visual.width('🇺🇸')).toBe(1) // Flag emoji

  // Mixed content that might appear in table headers
  expect(Str.Visual.width('Status ✓')).toBe(8)
  expect(Str.Visual.width('Count: 42')).toBe(9)
})

Test.on(Str.Visual.pad)
  .casesInput(
    ['hi', 5, 'right'],
    ['hi', 5, 'left'],
    ['hello', 3, 'left'], // Already wider
    ['x', 5, 'right', '-'], // Custom char
    ['hi', 5], // Defaults
    ['\x1b[31mOK\x1b[0m', 5, 'right'], // ANSI codes
  )
  .test(({ result, input }) => {
    expect(Str.Visual.width(result)).toBe(Math.max(Str.Visual.width(input[0] as string), input[1] as number))
    return result
  })

Test.on(Str.Visual.span)
  .casesInput(
    ['hi', 5, 'left'],
    ['hi', 5, 'right'],
    ['x', 5, 'left', '.'],
    ['\x1b[34mID\x1b[0m', 6, 'left'], // ANSI codes
  )
  .test(({ result, input }) => {
    expect(Str.Visual.width(result)).toBe(input[1])
    return result
  })

Test.on(Str.Visual.take)
  .casesInput(
    ['hello world', 5],
    ['hi', 10], // Size exceeds length
    ['\x1b[31mhello\x1b[0m world', 5], // ANSI codes
    ['👋 hello', 2], // Emoji
  )
  .test(({ result, input }) => {
    expect(Str.Visual.width(result)).toBeLessThanOrEqual(input[1] as number)
    return result
  })

Test.on(Str.Visual.takeWords)
  .casesInput(
    ['hello world here', 12],
    ['verylongword more', 8], // Word longer than width - overflow
    ['', 10],
    ['short', 10],
    ['\x1b[32mone\x1b[0m two three', 7], // ANSI codes
  )
  .test()

Test.on(Str.Visual.size)
  .cases(
    [['hello'], { maxWidth: 5, height: 1 }],
    [['hello\nworld'], { maxWidth: 5, height: 2 }],
    [['hi\nlonger line\nbye'], { maxWidth: 11, height: 3 }],
    [[''], { maxWidth: 0, height: 1 }],
    [['\x1b[31mred\x1b[0m\n\x1b[32mgreen!\x1b[0m'], { maxWidth: 6, height: 2 }], // ANSI codes
  )
  .test()

Test.on(Str.Visual.maxWidth)
  .cases(
    [['hello'], 5],
    [['short\nlonger line\nhi'], 11],
    [['\x1b[31mred\x1b[0m\n\x1b[32mgreen\x1b[0m'], 5], // ANSI codes
  )
  .test()

test('takeOn/takeWith match take', () => {
  const input = 'hello world'
  const expected = Str.Visual.take(input, 5)
  expect(Str.Visual.takeOn(input)(5)).toBe(expected)
  expect(Str.Visual.takeWith(5)(input)).toBe(expected)
})

test('takeWordsOn/takeWordsWith match takeWords', () => {
  const input = 'hello world here'
  const expected = Str.Visual.takeWords(input, 12)
  expect(Str.Visual.takeWordsOn(input)(12)).toEqual(expected)
  expect(Str.Visual.takeWordsWith(12)(input)).toEqual(expected)
})

Test.on(Str.Visual.wrap)
  .casesInput(
    ['xxxxx xxxxx', 10],
    ['xxxxx xxxxx xxxx', 10], // Multiple lines
    ['xxxxxxxxxxxx xxxx', 8], // Word longer than width (default: word-overflow)
    ['', 10], // Empty string
    ['xxxxx', 20], // Width exceeds text
    ['xxx\nxxx\nxxxxx', 10], // Pre-existing newlines
    ['xxxxx xxxxx', 5], // Very narrow width
    ['xxxxxxxxxxxx xxxx', 8, { strategy: 'word-overflow' }], // Strategy: word-overflow (explicit)
    ['xxxxxxxxxxxx xxxx', 8, { strategy: 'break-word' }], // Strategy: break-word
    ['xxxxxxxxxxxx xxxx', 8, { strategy: 'break-word-hyphen-in' }], // Strategy: break-word-hyphen-in
    ['xxxxxxxxxxxx xxxx', 8, { strategy: 'break-word-hyphen-out' }], // Strategy: break-word-hyphen-out
    ['\x1b[32mhello world here\x1b[0m', 12], // ANSI codes
    ['\x1b[31mred text that spans\x1b[0m multiple lines', 15], // ANSI across lines
  )
  .describeInputs('edge cases', [
    ['xxxxx', 0],
    ['xxxxx', 0, { strategy: 'break-word' }],
    ['xxxxx', 1, { strategy: 'break-word' }],
    ['xxxxx', 1, { strategy: 'break-word-hyphen-in' }],
    ['xxxxx', 1, { strategy: 'break-word-hyphen-out' }],
  ])
  .test()

test('wrapOn/wrapWith match wrap', () => {
  const input = 'hello world here'
  const expected = Str.Visual.wrap(input, 12)
  expect(Str.Visual.wrapOn(input)(12)).toEqual(expected)
  expect(Str.Visual.wrapWith(12)(input)).toEqual(expected)
})
