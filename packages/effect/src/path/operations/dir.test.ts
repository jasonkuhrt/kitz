import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import * as Path from '../__.js'

describe('dir', () => {
  it('returns file containers and navigated directory parents', () => {
    expect(Path.dir(Path.AbsFile.make('/a/b.txt'))).toEncodeTo('/a/')
    expect(Path.dir(Path.RelFile.make('../a/b.txt'))).toEncodeTo('../a/')
    expect(Path.dir(Path.AbsDir.make('/a/b/'))).toEncodeTo('/a/')
    expect(Path.dir(Path.RelDir.make('../a/b/'))).toEncodeTo('../a/')
  })

  it('obeys anchor parent semantics', () => {
    expect(Path.dir(Path.AbsDir.anchor)).toEqual(Path.AbsDir.anchor)
    expect(Path.dir(Path.RelDir.anchor)).toEqual(Path.RelDir.parent)
    expect(Path.dir(Path.RelDir.parent)).toEncodeTo('../../')
  })

  it('distributes its return over every variant and Any', () => {
    expectTypeOf(Path.dir(Path.AbsFile.make('/a.txt'))).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.dir(Path.RelFile.make('./a.txt'))).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.dir(Path.AbsDir.make('/a/'))).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.dir(Path.RelDir.make('./a/'))).toEqualTypeOf<Path.RelDir>()
    expectTypeOf<Path.DirOf<Path.Any>>().toEqualTypeOf<Path.AbsDir | Path.RelDir>()

    const widened = (path: Path.Any) => {
      expectTypeOf(Path.dir(path)).toEqualTypeOf<Path.AbsDir | Path.RelDir>()
    }
    expect(typeof widened).toBe('function')
  })
})
