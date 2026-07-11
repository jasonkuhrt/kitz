// Law: any edit that changes the runtime or type-level path grammar must change the other or this file goes red/uncompilable.
import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Schema as S } from 'effect'
import * as Path from './__.js'

const acceptedLiterals = [
  ['.', 'RelDir'],
  ['./', 'RelDir'],
  ['..', 'RelDir'],
  ['../', 'RelDir'],
  ['/', 'AbsDir'],
  ['/.', 'AbsDir'],
  ['/..', 'AbsDir'],
  ['/../', 'AbsDir'],
  ['./..', 'RelDir'],
  ['../.', 'RelDir'],
  ['a', 'RelFile'],
  ['a/', 'RelDir'],
  ['/a', 'AbsFile'],
  ['/a/', 'AbsDir'],
  ['./a', 'RelFile'],
  ['./a/', 'RelDir'],
  ['../a', 'RelFile'],
  ['a/../b', 'RelFile'],
  ['/a/../../b', 'AbsFile'],
  ['a/./b', 'RelFile'],
  ['.hidden', 'RelFile'],
  ['/etc/.hidden', 'AbsFile'],
  ['a.', 'RelFile'],
  ['/a.', 'AbsFile'],
  ['a..', 'RelFile'],
  ['name.tar.gz', 'RelFile'],
  ['a b/c d.txt', 'RelFile'],
  ['café/naïve.txt', 'RelFile'],
  [' ', 'RelFile'],
  ['a//b', 'RelFile'],
  ['/a//b', 'AbsFile'],
  ['a///b/', 'RelDir'],
  ['//x', 'AbsFile'],
  ['a/b/c/d/e/f/g/h/i/j/file.ts', 'RelFile'],
  ['./src/', 'RelDir'],
  ['/usr/local/bin/node', 'AbsFile'],
] as const

describe('path type⇄value grammar agreement', () => {
  it.each(acceptedLiterals)('%s classifies as %s at runtime', (literal, expected) => {
    expect(S.decodeSync(Path.Any)(literal)._tag).toBe(expected)
  })

  it('classifies every accepted literal identically at the type level', () => {
    expectTypeOf(Path.mk('.')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('./')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('..')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('../')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('/')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('/.')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('/..')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('/../')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('./..')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('../.')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('a')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('a/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('/a')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('/a/')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('./a')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('./a/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('../a')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('a/../b')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('/a/../../b')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a/./b')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('.hidden')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('/etc/.hidden')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a.')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('/a.')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a..')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('name.tar.gz')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('a b/c d.txt')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('café/naïve.txt')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk(' ')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('a//b')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('/a//b')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a///b/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('//x')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a/b/c/d/e/f/g/h/i/j/file.ts')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('./src/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('/usr/local/bin/node')).toEqualTypeOf<Path.AbsFile>()
  })

  it('rejects the empty string at both levels', () => {
    expect(() => S.decodeSync(Path.Any)('')).toThrow()

    const staticRejection = () => {
      // @ts-expect-error the empty string is not a path literal
      Path.mk('')
    }
    expect(typeof staticRejection).toBe('function')
  })
})
