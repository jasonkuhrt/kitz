import { describe, expect, test } from 'vitest'
import { match } from '../../Pattern/Pattern.js'
import * as Text from '../../lib/Text/Text.js'

describe('oak coverage helpers: pattern and text', () => {
  test('covers pattern edge cases that the behavioral suite skips', () => {
    expect(() => match([1] as any, undefined as any)).toThrow('Pattern: undefined')
    expect(() => match([1] as any, null as any)).toThrow('Pattern: null')
    expect(() => match([1] as any, Symbol.for('oak') as any)).toThrow('Pattern: Symbol(oak)')

    expect(match({ value: 1 } as any, (() => true) as any)).toBe(false)
    expect(match(1 as any, {} as any)).toBe(false)
    expect(match({ value: 1 }, { missing: 1 } as any)).toBe(false)
    expect(match([{ value: 1 }], [[{ value: 2 }], [{ value: 1 }]] as any)).toBe(true)
  })

  test('renders and measures text helpers', () => {
    expect(Text.line('oak')).toBe('oak\n')
    expect(Text.mapLines('a\nb', (line, index) => `${index}:${line}`)).toBe('0:a\n1:b')

    expect(Text.joinColumns([['a', 'bb'], ['ccc']], ' | ')).toBe('a  | ccc\nbb |    ')
    expect(Text.minSpan('left', 4, 'ok')).toBe('ok  ')
    expect(Text.minSpan('right', 4, 'ok')).toBe('  ok')
    expect(Text.padWithin('left', 5, '.', 'oak')).toBe('..oak')
    expect(Text.padWithin('right', 2, '.', 'oak')).toBe('oak')
    expect(Text.pad('left', 2, '.', 'oak')).toBe('..oak')
    expect(Text.pad('right', 2, '.', 'oak')).toBe('oak..')
    expect(Text.underline('oak')).toBe(`oak\n${Text.chars.lineH.repeat(3)}`)

    expect(Text.joinListEnglish([])).toBe('')
    expect(Text.joinListEnglish(['oak'])).toBe('oak')
    expect(Text.joinListEnglish(['oak', 'pine'])).toBe('oak or pine')
    expect(Text.joinListEnglish(['oak', 'pine', 'fir'])).toBe('oak, pine or fir')

    expect(Text.col({ lines: ['left'] })).toEqual({ lines: ['left'] })
    expect(
      Text.row([Text.col({ lines: ['a', 'bb'] }), Text.col({ lines: ['c'], separator: ' | ' })]),
    ).toBe(`a  | c\nbb |  `)

    expect(Text.toEnvarNameCase('releaseChannel')).toBe('RELEASE_CHANNEL')
    expect(Text.lines(5, 'alpha beta\ngamma')).toEqual(['alpha', 'beta', 'gamma'])

    expect(Text.indentBlock('a\nb', '> ')).toBe('> a\n> b')
    expect(Text.fromLines(['a', 'b'])).toBe('a\nb')
    expect(Text.toLines('a\nb')).toEqual(['a', 'b'])
    expect(Text.indentColumn(['a', 'b'], '> ')).toEqual(['> a', '> b'])
    expect(Text.indentColumn(['a', 'b'], (index) => `${index}:`)).toEqual(['0:a', '1:b'])
    expect(Text.indentBlockWith('a\nb', (_line, index) => `${index}:`)).toBe('0:a\n1:b')
    expect(Text.indentColumnWith(['a', 'b'], (_line, index) => `${index}:`)).toEqual(['0:a', '1:b'])

    expect(Text.defaultColumnSeparator).toBe('   ')
    expect(Text.visualStringTake('abcdef', 4)).toBe('abcd')
    expect(Text.maxWidth('a\nbbb')).toBe(3)
    expect(Text.measure('a\nbbb')).toEqual({ height: 2, maxWidth: 3 })
    expect(Text.visualStringTakeWords('alpha beta gamma', 10)).toEqual({
      taken: 'alpha beta',
      remaining: 'gamma',
    })
    expect(Text.visualStringTakeWords('superlongword', 5)).toEqual({
      taken: 'superlongword',
      remaining: '',
    })
    expect(Text.visualStringTakeWords('', 5)).toEqual({ taken: '', remaining: '' })
    expect(Text.chars.pipe).toBe('|')
  })
})
