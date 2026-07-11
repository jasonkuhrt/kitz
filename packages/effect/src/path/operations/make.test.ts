import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import { Option, Schema as S } from 'effect'
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

describe('make', () => {
  it.each(unionLiteralCases)('make(%s) agrees with union decode', (input) => {
    // The table callback is a finite union, deliberately outside make's
    // singleton-literal surface; erase it only to exercise the runtime law.
    expect(Path.make(input as any)._tag).toBe(S.decodeSync(Path.Any)(input)._tag)
  })

  it('types: literal shapes infer precise variants; dynamic strings are rejected', () => {
    expectTypeOf(Path.make('/home/u/f.txt')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.make('./src/')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.make('./.gitignore')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.make('../')).toEqualTypeOf<Path.RelDir>()

    const dynamic = '/x/y.txt' as string

    // Type-only: never executed, so the @ts-expect-error rejection cannot throw.
    const staticRejections = () => {
      // @ts-expect-error dynamic strings are rejected by Path.make; decode runtime strings through a schema
      Path.make(dynamic)
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
      Path.make('')
    }
    expect(typeof invalidLiteralRejections).toBe('function')
  })

  it('target constructors are lenient for dirs and statically reject mismatches', () => {
    const decoded = Path.AbsDir.make('/releases/v1.2')
    expect(decoded).toEncodeTo('/releases/v1.2/')
    expectTypeOf(decoded).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.RelFile.make('./.gitignore')).toEqualTypeOf<Path.RelFile>()

    // Type-only: never executed, so the @ts-expect-error rejections cannot throw.
    const staticRejections = () => {
      // @ts-expect-error absolute literal rejected by a RelFile target
      Path.RelFile.make('/abs.txt')
      // @ts-expect-error dir-shaped literal rejected by an AbsFile target
      Path.AbsFile.make('/a/b/')
      // @ts-expect-error relative literal rejected by an AbsFile target
      Path.AbsFile.make('./x')
      // @ts-expect-error absolute literal rejected by a RelDir target
      Path.RelDir.make('/x/')
      // @ts-expect-error dynamic strings rejected by literal-only target constructors
      Path.AbsDir.make('/x/' as string)
    }
    expect(typeof staticRejections).toBe('function')
  })

  it('preserves every structured make form and the schema make options', () => {
    const segment = Path.Segment.make('src')
    const fileName = Path.FileName.make({
      stem: 'index',
      extension: Option.some(Path.Extension.make('.ts')),
    })
    const absDir = Path.AbsDir.make({ segments: [segment] })
    const relDir = Path.RelDir.make({ ascent: 1, segments: [segment] })
    const absFile = Path.AbsFile.make({ dir: absDir, fileName }, { disableChecks: false })
    const relFile = Path.RelFile.make({ dir: relDir, fileName }, { disableChecks: false })

    expect(Path.AbsDir.make({})).toEncodeTo('/')
    expect(Path.RelDir.make({})).toEncodeTo('./')
    expect(absFile).toEncodeTo('/src/index.ts')
    expect(relFile).toEncodeTo('../src/index.ts')
    expect(Path.Abs.make(absFile)).toBe(absFile)
    expect(Path.Rel.make(relFile)).toBe(relFile)
    expect(Path.File.make(absFile)).toBe(absFile)
    expect(Path.Dir.make(relDir)).toBe(relDir)
    expectTypeOf(Path.Abs.make(absFile)).toEqualTypeOf<Path.Abs>()
    expectTypeOf(Path.Rel.make(relFile)).toEqualTypeOf<Path.Rel>()
    expectTypeOf(Path.File.make(absFile)).toEqualTypeOf<Path.File>()
    expectTypeOf(Path.Dir.make(relDir)).toEqualTypeOf<Path.Dir>()
  })

  it('does not let path literals escape into the structured overload', () => {
    type $Malformed = Types.StaticError<'The empty string is not a path'>
    type $NotLiteral = LiteralCore.ErrorStringNotLiteral
    type $MalformedParameter = Parameters<typeof Path.AbsFile.make<''>>[0]
    type $DynamicParameter = Parameters<typeof Path.AbsFile.make<string>>[0]
    type $OpenParameter = Parameters<typeof Path.AbsFile.make<`/${string}`>>[0]
    type $UnionParameter = Parameters<typeof Path.AbsFile.make<'/a' | '/b'>>[0]

    expectTypeOf<LiteralCore.LiteralGuard<'', Path.AbsFile>>().toEqualTypeOf<$Malformed>()
    expectTypeOf<LiteralCore.LiteralGuard<string, Path.AbsFile>>().toEqualTypeOf<$NotLiteral>()
    expectTypeOf<
      LiteralCore.LiteralGuard<`/${string}`, Path.AbsFile>
    >().toEqualTypeOf<$NotLiteral>()
    expectTypeOf<LiteralCore.LiteralGuard<'/a' | '/b', Path.AbsFile>>().toEqualTypeOf<$NotLiteral>()
    expectTypeOf<$MalformedParameter>().toEqualTypeOf<$Malformed>()
    expectTypeOf<$DynamicParameter>().toEqualTypeOf<$NotLiteral>()
    expectTypeOf<$OpenParameter>().toEqualTypeOf<$NotLiteral>()
    expectTypeOf<$UnionParameter>().toEqualTypeOf<$NotLiteral>()

    const dynamic = '/a' as string
    const open = '/a' as `/${string}`
    const union = '/a' as '/a' | '/b'
    const staticRejections = () => {
      // @ts-expect-error malformed literals surface the LiteralGuard error
      Path.AbsFile.make('')
      // @ts-expect-error widened path strings remain on schema decode APIs
      Path.AbsFile.make(dynamic)
      // @ts-expect-error open templates are not singleton literals
      Path.AbsFile.make(open)
      // @ts-expect-error finite unions do not identify one runtime literal
      Path.AbsFile.make(union)
    }
    expect(typeof staticRejections).toBe('function')
  })
})

describe('finding 1: dot-only compound literals are directories at the type level', () => {
  it('classifies dot-only compound literals as directories', () => {
    expectTypeOf(Path.make('/.')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.make('/..')).toEqualTypeOf<Path.AbsDir>()
    expectTypeOf(Path.make('./..')).toEqualTypeOf<Path.RelDir>()
    expectTypeOf(Path.make('../.')).toEqualTypeOf<Path.RelDir>()
  })
})

describe('finding 3: repeated separators collapse at the type level like runtime', () => {
  it('classifies repeated-separator literals after normalization', () => {
    expectTypeOf(Path.make('a//b')).toEqualTypeOf<Path.RelFile>()
    expectTypeOf(Path.make('/a//b')).toEqualTypeOf<Path.AbsFile>()
    expectTypeOf(Path.make('a///b/')).toEqualTypeOf<Path.RelDir>()
  })
})

describe('audit round 3: literal guards reject open string patterns', () => {
  it('maps path, segment, and extension patterns to their dynamic-string errors', () => {
    type $PathExpected = LiteralCore.ErrorStringNotLiteral
    type $SegmentExpected =
      Types.StaticError<'Segment.make requires a string literal. Use a widened string for runtime validation through Path.Segment.'>
    type $ExtensionExpected =
      Types.StaticError<'Extension.make requires a string literal. Use a widened string for runtime validation through Path.Extension.'>

    expectTypeOf<LiteralCore.LiteralInput<`./${string}`>>().toEqualTypeOf<$PathExpected>()
    expectTypeOf<SegmentLiteralGuard<`name-${string}`>>().toEqualTypeOf<$SegmentExpected>()
    expectTypeOf<ExtensionLiteralGuard<`.${string}`>>().toEqualTypeOf<$ExtensionExpected>()

    const openRelative = './src/' as `./${string}`
    const openAbsolute = '/src/' as `/${string}`
    const intrinsic = 'SRC' as Uppercase<string>
    const finiteUnion = './a' as './a' | './b'
    const openExtension = '.ts' as `.${string}`
    const extensionUnion = '.json' as '.json' | '.ts'

    const staticRejections = () => {
      // @ts-expect-error open relative templates are not singleton literals
      Path.make(openRelative)
      // @ts-expect-error target constructors reject open absolute templates
      Path.AbsDir.make(openAbsolute)
      // @ts-expect-error intrinsic string patterns are not singleton literals
      Path.make(intrinsic)
      // @ts-expect-error finite unions do not identify one runtime string
      Path.make(finiteUnion)
    }
    expect(typeof staticRejections).toBe('function')
    expect(Path.Extension.make(openExtension)).toBe('.ts')
    expect(Path.Extension.make(extensionUnion)).toBe('.json')
  })
})
