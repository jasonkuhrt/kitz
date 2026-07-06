import type { Analysis } from '../analyzer.js'
import type { AbsDir } from '../models/AbsDir.js'
import type { AbsFile } from '../models/AbsFile.js'
import type { Any } from '../models/Any.js'
import type { RelDir } from '../models/RelDir.js'
import type { RelFile } from '../models/RelFile.js'

type Separator = '/'
type Here = '.'
type Ascent = '..'

type IsAbsolute<S extends string> = S extends `${Separator}${string}` ? true : false

type IsDirectorySyntax<S extends string> = S extends '' | Here | './' | Ascent | '../'
  ? true
  : S extends `${string}${Separator}`
    ? true
    : false

type StripRoot<S extends string> = S extends `${Separator}${infer Rest}` ? Rest : S

type StripLeadingAscent<S extends string> = S extends `../${infer Rest}`
  ? StripLeadingAscent<Rest>
  : S

type StripLeadingHere<S extends string> = S extends `./${infer Rest}` ? Rest : S

type Split<S extends string, Acc extends readonly string[] = []> = S extends ''
  ? Acc
  : S extends `${infer Segment}${Separator}${infer Rest}`
    ? Segment extends ''
      ? Split<Rest, Acc>
      : Split<Rest, readonly [...Acc, Segment]>
    : readonly [...Acc, S]

type NormalizeSegments<
  Segments extends readonly string[],
  Acc extends readonly string[] = [],
> = Segments extends readonly [
  infer Segment extends string,
  ...infer Rest extends readonly string[],
]
  ? Segment extends Ascent
    ? Acc extends readonly [...infer Prefix extends readonly string[], string]
      ? NormalizeSegments<Rest, Prefix>
      : NormalizeSegments<Rest, Acc>
    : Segment extends Here | ''
      ? NormalizeSegments<Rest, Acc>
      : NormalizeSegments<Rest, readonly [...Acc, Segment]>
  : Acc

type NormalizedSegments<S extends string> = NormalizeSegments<
  Split<StripLeadingHere<StripLeadingAscent<StripRoot<S>>>>
>

type Last<Items extends readonly string[]> = Items extends readonly [
  ...(readonly string[]),
  infer Last,
]
  ? Last
  : never

type EndsWithDot<S extends string> = S extends `${string}.` ? true : false

type IsValidFileName<S extends string> = S extends '' | Here | Ascent
  ? false
  : EndsWithDot<S> extends true
    ? false
    : true

type CanDecodeFile<S extends string> =
  IsDirectorySyntax<S> extends true
    ? false
    : Last<NormalizedSegments<S>> extends infer FileName extends string
      ? IsValidFileName<FileName>
      : false

type LiteralAnalysisFile<Absolute extends boolean> = {
  readonly _tag: 'file'
  readonly isPathAbsolute: Absolute
  readonly ascent: number
  readonly segments: string[]
  readonly fileName: string
}

type LiteralAnalysisDir<Absolute extends boolean> = {
  readonly _tag: 'dir'
  readonly isPathAbsolute: Absolute
  readonly ascent: number
  readonly segments: string[]
}

type AnalyzeLiteral<S extends string> =
  IsAbsolute<S> extends true
    ? CanDecodeFile<S> extends true
      ? LiteralAnalysisFile<true>
      : LiteralAnalysisDir<true>
    : CanDecodeFile<S> extends true
      ? LiteralAnalysisFile<false>
      : LiteralAnalysisDir<false>

type FromLiteralAnalysis<A> = A extends { readonly _tag: 'file'; readonly isPathAbsolute: true }
  ? AbsFile
  : A extends { readonly _tag: 'file'; readonly isPathAbsolute: false }
    ? RelFile
    : A extends { readonly _tag: 'dir'; readonly isPathAbsolute: true }
      ? AbsDir
      : A extends { readonly _tag: 'dir'; readonly isPathAbsolute: false }
        ? RelDir
        : never

/** Type-level path literal analysis matching `S.decodeSync(Path.Any)` classification. */
export type LiteralAnalysis<S extends string> = string extends S
  ? Analysis
  : S extends string
    ? AnalyzeLiteral<S>
    : never

/** The decoded path variant for a path string literal, or `Any` for non-literal `string`. */
export type FromLiteral<S extends string> = string extends S
  ? Any
  : S extends string
    ? FromLiteralAnalysis<AnalyzeLiteral<S>>
    : never
