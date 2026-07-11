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
    // The table callback is a finite union, deliberately outside mk's
    // singleton-literal surface; erase it only to exercise the runtime law.
    expect(Path.mk(input as any)._tag).toBe(S.decodeSync(Path.Any)(input)._tag)
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

    expectTypeOf<LiteralCore.LiteralInput<`./${string}`>>().toEqualTypeOf<$PathExpected>()
    expectTypeOf<SegmentLiteralGuard<`name-${string}`>>().toEqualTypeOf<$SegmentExpected>()
    expectTypeOf<ExtensionLiteralGuard<`.${string}`>>().toEqualTypeOf<$ExtensionExpected>()

    const openRelative = './src/' as `./${string}`
    const openAbsolute = '/src/' as `/${string}`
    const intrinsic = 'SRC' as Uppercase<string>
    const finiteUnion = './a' as './a' | './b'

    const staticRejections = () => {
      // @ts-expect-error open relative templates are not singleton literals
      Path.mk(openRelative)
      // @ts-expect-error target constructors reject open absolute templates
      Path.AbsDir.mk(openAbsolute)
      // @ts-expect-error intrinsic string patterns are not singleton literals
      Path.mk(intrinsic)
      // @ts-expect-error finite unions do not identify one runtime string
      Path.mk(finiteUnion)
      // @ts-expect-error Extension.mk rejects open templates
      Path.Extension.mk(`.${openRelative}` as `.${string}`)
    }
    expect(typeof staticRejections).toBe('function')
  })
})
