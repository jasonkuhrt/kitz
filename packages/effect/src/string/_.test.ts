import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { String } from './_.js'

const removeTrailing = (value: string, suffix: string): string => {
  if (suffix === '') return value
  while (value.endsWith(suffix)) value = value.slice(0, -suffix.length)
  return value
}

const afterLast = (value: string, delimiter: string): string => {
  const index = value.lastIndexOf(delimiter)
  return index === -1 ? value : value.slice(index + delimiter.length)
}

describe('EndsWith / StartsWith', () => {
  it('matches String.prototype endsWith and startsWith', () => {
    expectTypeOf<String.EndsWith<'typescript', 'script'>>().toEqualTypeOf<true>()
    expect('typescript'.endsWith('script')).toBe(true)
    expectTypeOf<String.EndsWith<'typescript', 'type'>>().toEqualTypeOf<false>()
    expect('typescript'.endsWith('type')).toBe(false)

    expectTypeOf<String.StartsWith<'typescript', 'type'>>().toEqualTypeOf<true>()
    expect('typescript'.startsWith('type')).toBe(true)
    expectTypeOf<String.StartsWith<'typescript', 'script'>>().toEqualTypeOf<false>()
    expect('typescript'.startsWith('script')).toBe(false)
  })
})

describe('RemoveTrailing', () => {
  it('recursively strips suffixes, including the whole input', () => {
    expectTypeOf<String.RemoveTrailing<'path////', '/'>>().toEqualTypeOf<'path'>()
    expect(removeTrailing('path////', '/')).toBe('path')
    expectTypeOf<String.RemoveTrailing<'/', '/'>>().toEqualTypeOf<''>()
    expect(removeTrailing('/', '/')).toBe('')
    expectTypeOf<String.RemoveTrailing<'abab', 'ab'>>().toEqualTypeOf<''>()
    expect(removeTrailing('abab', 'ab')).toBe('')
  })

  it('keeps inputs unchanged for absent or empty suffixes', () => {
    expectTypeOf<String.RemoveTrailing<'path', '/'>>().toEqualTypeOf<'path'>()
    expect(removeTrailing('path', '/')).toBe('path')
    expectTypeOf<String.RemoveTrailing<'path', ''>>().toEqualTypeOf<'path'>()
    expect(removeTrailing('path', '')).toBe('path')
  })
})

describe('AfterLast', () => {
  it('matches slicing after String.prototype lastIndexOf', () => {
    expectTypeOf<String.AfterLast<'a/b/c', '/'>>().toEqualTypeOf<'c'>()
    expect(afterLast('a/b/c', '/')).toBe('c')
    expectTypeOf<String.AfterLast<'abc', '/'>>().toEqualTypeOf<'abc'>()
    expect(afterLast('abc', '/')).toBe('abc')
    expectTypeOf<String.AfterLast<'a/', '/'>>().toEqualTypeOf<''>()
    expect(afterLast('a/', '/')).toBe('')
    expectTypeOf<String.AfterLast<'abc', ''>>().toEqualTypeOf<''>()
    expect(afterLast('abc', '')).toBe('')
  })
})

describe('Split', () => {
  it('matches String.prototype.split for delimiters and empty segments', () => {
    expectTypeOf<String.Split<'a//b', '/'>>().toEqualTypeOf<['a', '', 'b']>()
    expect('a//b'.split('/')).toEqual(['a', '', 'b'])
    expectTypeOf<String.Split<'a/', '/'>>().toEqualTypeOf<['a', '']>()
    expect('a/'.split('/')).toEqual(['a', ''])
    expectTypeOf<String.Split<'', '/'>>().toEqualTypeOf<['']>()
    expect(''.split('/')).toEqual([''])
  })

  it('matches String.prototype.split for an empty delimiter', () => {
    expectTypeOf<String.Split<'abc', ''>>().toEqualTypeOf<['a', 'b', 'c']>()
    expect('abc'.split('')).toEqual(['a', 'b', 'c'])
    expectTypeOf<String.Split<'', ''>>().toEqualTypeOf<[]>()
    expect(''.split('')).toEqual([])
  })

  it('widens non-literal inputs', () => {
    expectTypeOf<String.Split<string, '/'>>().toEqualTypeOf<string[]>()
    expectTypeOf<String.Split<'a/b', string>>().toEqualTypeOf<string[]>()
  })
})
