import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  omit,
  omitOn,
  omitUndefined,
  omitWith,
  partition,
  pick,
  pickMatching,
  pickOn,
  pickWith,
  policyFilter,
} from './obj/filter.js'
import {
  entries,
  entriesStrict,
  getRandomly,
  getValueAtPath,
  keysStrict,
  stringKeyEntries,
  values,
} from './obj/get.js'
import {
  asWritable,
  assert as assertObject,
  fromEntries,
  getPrivateState,
  hasNonUndefinedKeys,
  hasSymbolLike,
  hasSymbolLikeWith,
  isShape,
  setPrivateState,
} from './obj/obj.js'
import { empty, emptyObject, isEmpty, isEmpty$ } from './obj/type.js'
import {
  isMatch,
  isMatchAny,
  isMatchAnyOn,
  isMatchAnyWith,
  isMatchOn,
  isMatchWith,
  isNotMatchAny,
  match,
  matchAll,
  matchAllOn,
  matchAllWith,
  matchOn,
  matchWith,
  pattern,
  patternWith,
} from './str/match.js'
import {
  append,
  appendOn,
  appendWith,
  prepend,
  prependOn,
  prependWith,
  removeSurrounding,
  removeSurroundingOn,
  removeSurroundingSpaceNoBreak,
  removeSurroundingSpaceRegular,
  removeSurroundingWith,
  repeat,
  repeatOn,
  repeatWith,
  replace,
  replaceAll,
  replaceAllOn,
  replaceAllWith,
  replaceLeading,
  replaceLeadingOn,
  replaceLeadingWith,
  replaceOn,
  replaceWith,
  strip,
  stripLeading,
  trim,
  truncate,
  truncateOn,
  truncateWith,
} from './str/replace.js'
import { join, joinOn, joinWith, merge, mergeOn, split, splitOn, splitWith } from './str/split.js'
import {
  cr,
  crlf,
  defaultIndentCharacter,
  defaultIndentSize,
  defaultLineSeparator,
  defaultPadCharacter,
  fit,
  fitOn,
  fitWith,
  formatBlock,
  formatBlockOn,
  formatBlockWith,
  indent,
  indentBy,
  indentByOn,
  indentByWith,
  indentOn,
  indentWith,
  lf,
  lineEndingPattern,
  lines,
  mapLines,
  mapLinesOn,
  mapLinesWith,
  normalizeLineEndings,
  pad,
  padLeft,
  padLeftOn,
  padLeftWith,
  padOn,
  padRight,
  padRightOn,
  padRightWith,
  padWith,
  span,
  spanOn,
  spanWith,
  stripIndent,
  unlines,
} from './str/text.js'

describe('core object and string coverage', () => {
  test('covers object access and filtering helpers', () => {
    const source = {
      a: 1,
      b: undefined,
      c: { nested: true },
      'data-mode': 'strict',
    }

    expect(entries({ a: 1, b: undefined })).toEqual([
      ['a', 1],
      ['b', undefined],
    ])
    expect(stringKeyEntries({ a: 1, b: 2 })).toEqual([
      ['a', 1],
      ['b', 2],
    ])
    expect(entriesStrict({ a: 1, b: undefined, c: 2 })).toEqual([
      ['a', 1],
      ['c', 2],
    ])
    expect(keysStrict({ a: 1, b: 2 })).toEqual(['a', 'b'])

    expect(['first', 'second']).toContain(getRandomly({ a: 'first', b: 'second' }))
    expect(getRandomly({})).toBeUndefined()

    expect(getValueAtPath({ a: { b: { c: 42 } } }, ['a', 'b', 'c'])).toBe(42)
    expect(getValueAtPath({ a: null }, ['a', 'b'])).toBeUndefined()
    expect(values({ a: 1, b: 'two' })).toEqual([1, 'two'])

    expect(pick(source, ['a', 'c'])).toEqual({
      a: 1,
      c: { nested: true },
    })
    expect(pick(source, (key) => key !== 'b')).toEqual({
      a: 1,
      c: { nested: true },
      'data-mode': 'strict',
    })
    expect(pick(source, (_key, value) => value === source.c)).toEqual({
      c: { nested: true },
    })
    expect(pickWith(['a'])(source)).toEqual({ a: 1 })
    expect(pickOn(source)(['c'])).toEqual({ c: { nested: true } })

    expect(omit(source, ['b'])).toEqual({
      a: 1,
      c: { nested: true },
      'data-mode': 'strict',
    })
    expect(omit(source, (_key, value) => value === undefined)).toEqual({
      a: 1,
      c: { nested: true },
      'data-mode': 'strict',
    })
    expect(omitWith(['a'])(source)).toEqual({
      b: undefined,
      c: { nested: true },
      'data-mode': 'strict',
    })
    expect(omitOn(source)((key) => key === 'c')).toEqual({
      a: 1,
      b: undefined,
      'data-mode': 'strict',
    })

    expect(policyFilter('allow', source, ['a', 'c'])).toEqual({
      a: 1,
      c: { nested: true },
    })
    expect(policyFilter('deny', source, ['b'])).toEqual({
      a: 1,
      c: { nested: true },
      'data-mode': 'strict',
    })
    expect(omitUndefined(source)).toEqual({
      a: 1,
      c: { nested: true },
      'data-mode': 'strict',
    })
    expect(partition(source, ['a', 'c'])).toEqual({
      picked: { a: 1, c: { nested: true } },
      omitted: { b: undefined, 'data-mode': 'strict' },
    })
    expect(pickMatching(source, (key) => key.startsWith('data-'))).toEqual({
      'data-mode': 'strict',
    })
  })

  test('covers object predicates and constructors', () => {
    assertObject({ ready: true })
    expect(() => assertObject('oak')).toThrow('Expected object')

    const isUser = isShape<{ name: string; active: boolean }>({
      name: 'string',
      active: 'boolean',
    })
    expect(isUser({ name: 'oak', active: true })).toBe(true)
    expect(isUser({ name: 'oak' })).toBe(false)

    const target = { visible: true }
    const state = { secret: 1 }
    expect(setPrivateState(target, state)).toBe(target)
    expect(getPrivateState<typeof state>(target)).toBe(state)
    expect(() => getPrivateState({})).toThrow('Private state not found')

    expect(hasNonUndefinedKeys({ a: undefined })).toBe(false)
    expect(hasNonUndefinedKeys({ a: undefined, b: null })).toBe(true)

    const transport1 = Symbol('transport')
    const transport2 = Symbol('transport')
    const value = { [transport1]: 'http' }
    expect(hasSymbolLike(value, transport1, 'http')).toBe(true)
    expect(hasSymbolLike(value, transport2, 'http')).toBe(true)
    expect(hasSymbolLike('nope', transport1, 'http')).toBe(false)
    expect(hasSymbolLikeWith(transport1, 'http')(value)).toBe(true)

    expect(
      fromEntries([
        ['a', 1],
        ['b', 'two'],
      ] as const),
    ).toEqual({
      a: 1,
      b: 'two',
    })

    const writable = asWritable({ name: 'oak' } as const)
    ;(writable as { name: string }).name = 'pine'
    expect(writable.name).toBe('pine')

    expect(emptyObject).toEqual({})
    expect(Object.isFrozen(emptyObject)).toBe(true)

    const madeEmpty = empty()
    expect(madeEmpty).toEqual({})
    expect(Object.isFrozen(madeEmpty)).toBe(true)
    expect(isEmpty({})).toBe(true)
    expect(isEmpty({ a: 1 })).toBe(false)

    const nonEnumerableOnly = {}
    Object.defineProperty(nonEnumerableOnly, 'secret', { value: 1, enumerable: false })
    expect(isEmpty(nonEnumerableOnly)).toBe(true)

    const maybeEmpty: { a?: number } = {}
    expect(isEmpty$(maybeEmpty)).toBe(true)
  })

  test('covers string split and match helpers', () => {
    expect(split('a,b,c', ',')).toEqual(['a', 'b', 'c'])
    expect(splitOn('a|b')('|')).toEqual(['a', 'b'])
    expect(splitWith('-')('a-b')).toEqual(['a', 'b'])
    expect(join(['a', 'b'], ':')).toBe('a:b')
    expect(joinOn(['a', 'b'])(' / ')).toBe('a / b')
    expect(joinWith(' + ')(['a', 'b'])).toBe('a + b')
    expect(merge('foo', 'bar')).toBe('foobar')
    expect(mergeOn('foo')('bar')).toBe('foobar')

    const exact = match('oak', 'oak')
    expect(Option.isSome(exact)).toBe(true)
    if (Option.isSome(exact)) {
      expect(exact.value).toEqual({
        value: 'oak',
        offset: 0,
        captures: [],
        groups: {},
        input: 'oak',
      })
    }
    expect(Option.isNone(match('oak', 'pine'))).toBe(true)

    const regexMatch = match('hello jane', /hello (?<name>\w+)/)
    expect(Option.isSome(regexMatch)).toBe(true)
    if (Option.isSome(regexMatch)) {
      expect(regexMatch.value.value).toBe('hello jane')
      expect(regexMatch.value.captures).toEqual(['jane'])
      expect(regexMatch.value.groups).toEqual({ name: 'jane' })
      expect(regexMatch.value.input).toBe('hello jane')
    }

    expect(pattern('foo+', 'g').flags).toContain('g')
    expect(pattern.as(/foo+/).source).toBe('foo+')
    expect(pattern.as('bar+').source).toBe('bar+')
    expect(patternWith('g')('\\d+').flags).toContain('g')

    expect(Option.isSome(matchOn('hello jane')(/jane/))).toBe(true)
    expect(Option.isSome(matchWith(/hello/)('hello jane'))).toBe(true)

    const digitPattern = patternWith('g')('\\d+')
    const digitCharPattern = /\d/g
    expect(Array.from(matchAll('a1b22', digitPattern), (found) => found[0])).toEqual(['1', '22'])
    expect(
      Array.from((matchAllOn('a1b2') as any)(digitCharPattern), (found: any) => found[0]),
    ).toEqual(['1', '2'])
    expect(
      Array.from((matchAllWith as any)(digitCharPattern)('a1b2'), (found: any) => found[0]),
    ).toEqual(['1', '2'])

    expect(isMatch('hello', 'hello')).toBe(true)
    expect(isMatch('hello', /^he/)).toBe(true)
    expect(isMatchOn('a1')(/\d/)).toBe(true)
    expect(isMatchWith(/^a/)('abc')).toBe(true)
    expect(isMatchAny('hello', 'hello')).toBe(true)
    expect(isMatchAny('hello', [/^x/, /^h/])).toBe(true)
    expect(isMatchAnyOn('world')([/^x/, /ld$/])).toBe(true)
    expect(isMatchAnyWith([/^x/, /^w/])('world')).toBe(true)
    expect(isNotMatchAny([/^x/, /^y/])('world')).toBe(true)
  })

  test('covers string replacement and text formatting helpers', () => {
    expect(trim('\n hello \t')).toBe('hello')

    expect(replaceLeading('$', '//', '// note')).toBe('$ note')
    expect(replaceLeadingWith('$')('//')('// note')).toBe('$ note')
    expect(replaceLeadingOn('// note')('$')('//')).toBe('$ note')
    expect(stripLeading('//')('// note')).toBe(' note')

    const greetingPattern = pattern('hello (?<name>\\w+)')
    expect(replace('hello world', ' ', '_')).toBe('hello_world')
    expect(replace('a-b-c', ['a', 'c'], 'x')).toBe('x-b-x')
    expect(
      replace('hello jane', greetingPattern, (found) => {
        const name = found.groups.name

        if (name === undefined) {
          throw new Error('expected name capture')
        }

        return name.toUpperCase()
      }),
    ).toBe('JANE')
    expect(replace('a1', /\d/, '#')).toBe('a#')
    expect((replaceOn as any)('hello world')('world')('kitz')).toBe('hello kitz')
    expect(replaceWith('world', 'kitz')('hello world')).toBe('hello kitz')

    expect(replaceAll('a-a', 'a', 'x')).toBe('x-x')
    expect(replaceAll('a-b-a', ['a', 'b'], 'x')).toBe('x-x-x')
    const digits = pattern('\\d', 'g')
    expect(replaceAll('a1b2', digits, (found) => `[${found.value}]`)).toBe('a[1]b[2]')
    expect(replaceAll('a1b2', /\d/g, '#')).toBe('a#b#')
    expect((replaceAllOn as any)('a-a')('a')('x')).toBe('x-x')
    expect(replaceAllWith(/\d/g, '#')('a1b2')).toBe('a#b#')

    expect(append('hello', ' world')).toBe('hello world')
    expect(appendOn('hello')(' world')).toBe('hello world')
    expect(appendWith(' world')('hello')).toBe('hello world')
    expect(prepend(' world', 'hello')).toBe('hello world')
    expect(prependOn(' world')('hello')).toBe('hello world')
    expect(prependWith('hello')(' world')).toBe('hello world')
    expect(repeat('ha', 2)).toBe('haha')
    expect(repeatOn('ha')(3)).toBe('hahaha')
    expect(repeatWith(3)('ha')).toBe('hahaha')
    expect(removeSurrounding('***test***', '*')).toBe('test')
    expect(removeSurrounding('', '*')).toBe('')
    expect(removeSurroundingOn('***test***')('*')).toBe('test')
    expect(removeSurroundingWith('*')('***test***')).toBe('test')
    expect(truncate('hello world', 8)).toBe('hello...')
    expect(truncate('hi', 8)).toBe('hi')
    expect(truncateOn('hello world')(5)).toBe('he...')
    expect(truncateWith(5)('hello world')).toBe('he...')
    expect(strip(/[aeiou]/g)('hello world')).toBe('hll wrld')
    expect(removeSurroundingSpaceRegular(' hello ')).toBe('hello')
    expect(removeSurroundingSpaceNoBreak('\u00a0hello\u00a0')).toBe('hello')

    expect(defaultIndentSize).toBe(2)
    expect(defaultIndentCharacter).toBe('\u00a0')
    expect(defaultLineSeparator).toBe('\n')
    expect(defaultPadCharacter).toBe(' ')
    expect(cr).toBe('\r')
    expect(lf).toBe('\n')
    expect(crlf).toBe('\r\n')
    expect('a\r\nb'.split(lineEndingPattern)).toEqual(['a', 'b'])
    expect(normalizeLineEndings('a\r\nb\rc')).toBe('a\nb\nc')
    expect(lines('a\r\nb\rc\n')).toEqual(['a', 'b', 'c', ''])
    expect(unlines(['a', 'b'])).toBe('a\nb')

    expect(indent('a\nb')).toBe(
      `${defaultIndentCharacter.repeat(2)}a\n${defaultIndentCharacter.repeat(2)}b`,
    )
    expect(indentOn('a\nb')(4)).toBe(
      `${defaultIndentCharacter.repeat(4)}a\n${defaultIndentCharacter.repeat(4)}b`,
    )
    expect(indentWith(3)('a\nb')).toBe(
      `${defaultIndentCharacter.repeat(3)}a\n${defaultIndentCharacter.repeat(3)}b`,
    )
    expect(indentBy('a\nb', '> ')).toBe('> a\n> b')
    expect(indentBy('a\nb', (_, index) => `${index}: `)).toBe('0: a\n1: b')
    expect(indentByOn('a\nb')('> ')).toBe('> a\n> b')
    expect(indentByWith('> ')('a\nb')).toBe('> a\n> b')
    expect(stripIndent('    a\n      b\n    c')).toBe('a\n  b\nc')
    expect(stripIndent('\n')).toBe('\n')

    expect(pad('oak', 2)).toBe('  oak')
    expect(padOn('oak')(2)).toBe('  oak')
    expect(padWith(2)('oak')).toBe('  oak')
    expect(padLeft('oak', 2, '0')).toBe('00oak')
    expect(padLeftOn('oak')(2)).toBe('  oak')
    expect(padLeftWith(2)('oak')).toBe('  oak')
    expect(padRight('oak', 2, '.')).toBe('oak..')
    expect(padRightOn('oak')(2)).toBe('oak  ')
    expect(padRightWith(2)('oak')).toBe('oak  ')
    expect(span('oak', 5, 'right', '.')).toBe('..oak')
    expect(spanOn('oak')(5)).toBe('oak  ')
    expect(spanWith(5)('oak')).toBe('oak  ')
    expect(fit('alphabet', 3)).toBe('alp')
    expect(fit('oak', 5, 'right', '.')).toBe('..oak')
    expect(fitOn('alphabet')(3)).toBe('alp')
    expect(fitWith(5)('oak')).toBe('oak  ')
    expect(mapLines('a\nb', (line, index) => `${index}:${line.toUpperCase()}`)).toBe('0:A\n1:B')
    expect(mapLinesOn('a\nb')((line) => line.toUpperCase())).toBe('A\nB')
    expect(mapLinesWith((line, index) => `${index}:${line}`)('a\nb')).toBe('0:a\n1:b')

    expect(formatBlock('single', { prefix: '> ' })).toBe('single')
    expect(formatBlock('a\nb', { prefix: '> ', indent: 1 })).toBe('>  a\n>  b')
    expect(formatBlock('head\nbody', { prefix: '  ', excludeFirstLine: true })).toBe('head\n  body')
    expect(
      formatBlock('a\nb', {
        prefix: {
          symbol: '|',
          color: (text) => `[${text}]`,
        },
        indent: 1,
      }),
    ).toBe('[|] a\n[|] b')
    expect(formatBlockOn('a\nb')({ prefix: '> ' })).toBe('> a\n> b')
    expect(formatBlockWith({ prefix: '> ' })('a\nb')).toBe('> a\n> b')
  })
})
