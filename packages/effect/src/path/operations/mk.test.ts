import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Schema as S } from 'effect'
import { Types } from '../../types/_.js'
import * as LiteralCore from '../core/literal.js'
import type { ExtensionLiteralGuard } from '../models/Extension.js'
import type { SegmentLiteralGuard } from '../models/segment.js'
import * as Path from '../__.js'

const unionLiteralCases = [
  'a/../b',
  './x/./y/',
  '.',
  '..',
  './.env.local',
  '/a/b',
  'x.',
  './.gitignore',
  '/',
  '/a/b/',
  '/releases/v1.2',
  '/etc/hostname',
  '/u/.gitignore',
  './',
  '../',
  '../x',
  '../x/',
  './x',
  './x/',
] as const

describe('mk', () => {
  it.each(unionLiteralCases)('mk(%s) agrees with union decode', (input) => {
    expect(Path.mk(input)._tag).toBe(S.decodeSync(Path.Any)(input)._tag)
  })

  it('types: literal shapes infer precise variants; dynamic strings are rejected', () => {
    expectTypeOf(Path.mk('/home/u/f.txt')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('./src/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('./.gitignore')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('../')).toEqualTypeOf<Path.RelDir>()

    const dynamic = '/x/y.txt' as string

    // Type-only: never executed, so the @ts-expect-error rejection cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected by Path.mk; decode runtime strings through a schema
      Path.mk(dynamic)
    }
    expect(typeof staticRejections).toBe('function')

    // the exported type utility: shapes not exercised through the function above
    expectTypeOf<Path.FromLiteral<'/'>>().toEqualTypeOf<Path.AbsDir>()
    expectTypeOf<Path.FromLiteral<'../x'>>().toEqualTypeOf<Path.RelFile>()
    expectTypeOf<Path.FromLiteral<'x.'>>().toEqualTypeOf<Path.RelFile>()
    expectTypeOf<Path.FromLiteral<'//'>>().toEqualTypeOf<Path.AbsDir>()
    expectTypeOf<Path.FromLiteral<''>>().toEqualTypeOf<never>()
    expectTypeOf<Path.FromLiteral<string>>().toEqualTypeOf<Path.Any>()

    const invalidLiteralRejections = () => {
      // @ts-expect-error the empty string is not a path literal
      Path.mk('')
    }
    expect(typeof invalidLiteralRejections).toBe('function')
  })

  it('target constructors are lenient for dirs and statically reject mismatches', () => {
    const decoded = Path.AbsDir.mk('/releases/v1.2')
    expect(decoded).toEncodeTo('/releases/v1.2/')
    expectTypeOf(decoded).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.RelFile.mk('./.gitignore')).toEqualTypeOf<Path.RelFile>()

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error absolute literal rejected by a RelFile target
      Path.RelFile.mk('/abs.txt')
      // @ts-expect-error dir-shaped literal rejected by an AbsFile target
      Path.AbsFile.mk('/a/b/')
      // @ts-expect-error relative literal rejected by an AbsFile target
      Path.AbsFile.mk('./x')
      // @ts-expect-error absolute literal rejected by a RelDir target
      Path.RelDir.mk('/x/')
      // @ts-expect-error dynamic strings rejected by literal-only target constructors
      Path.AbsDir.mk('/x/' as string)
    }
    expect(typeof staticRejections).toBe('function')
  })
})

describe('finding 1: dot-only compound literals are directories at the type level', () => {
  it('classifies dot-only compound literals as directories', () => {
    expectTypeOf(Path.mk('/.')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('/..')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.mk('./..')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.mk('../.')).toEqualTypeOf<Path.RelDir>()
  })
})

describe('finding 3: repeated separators collapse at the type level like runtime', () => {
  it('classifies repeated-separator literals after normalization', () => {
    expectTypeOf(Path.mk('a//b')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.mk('/a//b')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.mk('a///b/')).toEqualTypeOf<Path.RelDir>()
  })
})

describe('audit round 3: literal guards reject open string patterns', () => {
  it('maps path, segment, and extension patterns to their dynamic-string errors', () => {
    type $PathExpected = LiteralCore.ErrorStringNotLiteral
    type $SegmentExpected =
      Types.StaticError<'Segment literal constructors require a string literal. Decode dynamic strings through Path.Segment.'>
    type $ExtensionExpected =
      Types.StaticError<'Extension.mk requires a string literal. Decode dynamic strings through Path.Extension.'>

    // @ts-expect-error RED-PIN: open path templates currently evade the literal guard
    expectTypeOf<LiteralCore.LiteralInput<`./${string}`>>().toEqualTypeOf<$PathExpected>()
    // @ts-expect-error RED-PIN: open segment templates currently evade the literal guard
    expectTypeOf<SegmentLiteralGuard<`name-${string}`>>().toEqualTypeOf<$SegmentExpected>()
    // @ts-expect-error RED-PIN: open extension templates currently evade the literal guard
    expectTypeOf<ExtensionLiteralGuard<`.${string}`>>().toEqualTypeOf<$ExtensionExpected>()
  })
})
