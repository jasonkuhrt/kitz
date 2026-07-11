import type { StaticError } from '../../types/staticError.js'
import type { Analysis } from '../analyzer.js'
import type { Abs } from '../models/Abs.js'
import type { AbsDir } from '../models/AbsDir.js'
import type { AbsFile } from '../models/AbsFile.js'
import type { Any } from '../models/Any.js'
import type { Dir } from '../models/Dir.js'
import type { File } from '../models/File.js'
import type { Rel } from '../models/Rel.js'
import type { RelDir } from '../models/RelDir.js'
import type { RelFile } from '../models/RelFile.js'
import type { ascent, ascentPrefix, here, herePrefix, separator } from './grammar.js'
import type {
  emptyPathMessage,
  groupMismatchMessage,
  notTarget,
  requiresLiteral,
  targetDescription,
  validationHint,
} from './messages.js'

type IsAbsolute<$S extends string> = $S extends `${separator}${string}` ? true : false

type IsDirectorySyntax<$S extends string> = $S extends here | herePrefix | ascent | ascentPrefix
  ? true
  : $S extends `${string}${separator}`
    ? true
    : false

type StripRoot<$S extends string> = $S extends `${separator}${infer $Rest}` ? $Rest : $S

type StripLeadingAscent<$S extends string> = $S extends `${ascentPrefix}${infer $Rest}`
  ? StripLeadingAscent<$Rest>
  : $S

type StripLeadingHere<$S extends string> = $S extends `${herePrefix}${infer $Rest}` ? $Rest : $S

type Split<$S extends string, $Acc extends readonly string[] = []> = $S extends ''
  ? $Acc
  : $S extends `${infer $Segment}${separator}${infer $Rest}`
    ? $Segment extends ''
      ? Split<$Rest, $Acc>
      : Split<$Rest, readonly [...$Acc, $Segment]>
    : readonly [...$Acc, $S]

type NormalizeSegments<
  $Segments extends readonly string[],
  $Acc extends readonly string[] = [],
> = $Segments extends readonly [
  infer $Segment extends string,
  ...infer $Rest extends readonly string[],
]
  ? $Segment extends ascent
    ? $Acc extends readonly [...infer $Prefix extends readonly string[], string]
      ? NormalizeSegments<$Rest, $Prefix>
      : NormalizeSegments<$Rest, $Acc>
    : $Segment extends here | ''
      ? NormalizeSegments<$Rest, $Acc>
      : NormalizeSegments<$Rest, readonly [...$Acc, $Segment]>
  : $Acc

type NormalizedSegments<$S extends string> = NormalizeSegments<
  Split<StripLeadingHere<StripLeadingAscent<StripRoot<$S>>>>
>

type Last<$Items extends readonly string[]> = $Items extends readonly [
  ...(readonly string[]),
  infer $Last,
]
  ? $Last
  : never

type IsValidFileName<$S extends string> = $S extends '' | here | ascent ? false : true

type CanDecodeFile<$S extends string> =
  IsDirectorySyntax<$S> extends true
    ? false
    : NormalizedSegments<$S> extends infer $Segments extends readonly string[]
      ? $Segments extends readonly []
        ? false
        : Last<$Segments> extends infer $FileName extends string
          ? IsValidFileName<$FileName>
          : false
      : false

type LiteralAnalysisFile<$Absolute extends boolean> = {
  readonly _tag: 'file'
  readonly isPathAbsolute: $Absolute
  readonly ascent: number
  readonly segments: string[]
  readonly fileName: string
}

type LiteralAnalysisDir<$Absolute extends boolean> = {
  readonly _tag: 'dir'
  readonly isPathAbsolute: $Absolute
  readonly ascent: number
  readonly segments: string[]
}

type AnalyzeLiteral<$S extends string> = $S extends ''
  ? never
  : IsAbsolute<$S> extends true
    ? CanDecodeFile<$S> extends true
      ? LiteralAnalysisFile<true>
      : LiteralAnalysisDir<true>
    : CanDecodeFile<$S> extends true
      ? LiteralAnalysisFile<false>
      : LiteralAnalysisDir<false>

type FromLiteralAnalysis<$A> = $A extends { readonly _tag: 'file'; readonly isPathAbsolute: true }
  ? AbsFile
  : $A extends { readonly _tag: 'file'; readonly isPathAbsolute: false }
    ? RelFile
    : $A extends { readonly _tag: 'dir'; readonly isPathAbsolute: true }
      ? AbsDir
      : $A extends { readonly _tag: 'dir'; readonly isPathAbsolute: false }
        ? RelDir
        : never

type DecodeAbsLiteralAs<$S extends string, $Target> =
  CanDecodeFile<$S> extends true
    ? AbsFile extends $Target
      ? AbsFile
      : AbsDir extends $Target
        ? AbsDir
        : never
    : AbsDir extends $Target
      ? AbsDir
      : never

type DecodeRelLiteralAs<$S extends string, $Target> =
  CanDecodeFile<$S> extends true
    ? RelFile extends $Target
      ? RelFile
      : RelDir extends $Target
        ? RelDir
        : never
    : RelDir extends $Target
      ? RelDir
      : never

type IsExactly<$A, $B> = [$A] extends [$B] ? ([$B] extends [$A] ? true : false) : false

type TargetName<$Target> =
  IsExactly<$Target, AbsFile> extends true
    ? 'AbsFile'
    : IsExactly<$Target, AbsDir> extends true
      ? 'AbsDir'
      : IsExactly<$Target, RelFile> extends true
        ? 'RelFile'
        : IsExactly<$Target, RelDir> extends true
          ? 'RelDir'
          : IsExactly<$Target, Abs> extends true
            ? 'Abs'
            : IsExactly<$Target, Rel> extends true
              ? 'Rel'
              : IsExactly<$Target, File> extends true
                ? 'File'
                : IsExactly<$Target, Dir> extends true
                  ? 'Dir'
                  : 'Any'

type TargetDescription<$Target> = targetDescription<TargetName<$Target>>

type ValidationHint<$Target> = validationHint<TargetName<$Target>>

/** Type-level path literal analysis matching `S.decodeSync(Path.Any)` classification. */
export type LiteralAnalysis<$S extends string> = string extends $S
  ? Analysis
  : $S extends string
    ? AnalyzeLiteral<$S>
    : never

/** The decoded path variant for a path string literal, or `Any` for non-literal `string`. */
export type FromLiteral<$S extends string> = string extends $S
  ? Any
  : $S extends string
    ? FromLiteralAnalysis<AnalyzeLiteral<$S>>
    : never

/** Static error for dynamic strings passed to literal-only constructors. */
export type ErrorStringNotLiteral = StaticError<
  requiresLiteral<
    'Path literal constructors',
    '',
    'Use a path schema codec for dynamic strings, or decode the target schema at runtime.'
  >
>

/** Static error for a literal the path grammar itself rejects, naming the cause. */
export type ErrorMalformedLiteral<$Received extends string> = $Received extends ''
  ? StaticError<emptyPathMessage>
  : StaticError<`Path literal '${$Received}' is not a valid path literal.`>

/** Static error for path values from different anchoring groups. */
export type ErrorPathGroupMismatch = StaticError<groupMismatchMessage>

/** Static error for a well-formed literal that does not match the target path schema. */
export type ErrorPathValidation<$Target, $Received> = StaticError<
  notTarget<$Received & string, TargetDescription<$Target>, ValidationHint<$Target>>
>

/** Decode a string literal as a specific path target schema. */
export type FromTargetLiteral<$S extends string, $Target> = string extends $S
  ? never
  : $S extends string
    ? [AnalyzeLiteral<$S>] extends [never]
      ? never
      : IsAbsolute<$S> extends true
        ? DecodeAbsLiteralAs<$S, $Target>
        : DecodeRelLiteralAs<$S, $Target>
    : never

/** Guard the god literal constructor against non-literal or invalid strings. */
export type LiteralInput<$S extends string> = string extends $S
  ? ErrorStringNotLiteral
  : [AnalyzeLiteral<$S>] extends [never]
    ? ErrorMalformedLiteral<$S>
    : $S

/** Guard a string literal against a target path schema, returning a static error on mismatch. */
export type LiteralGuard<$S extends string, $Target> = string extends $S
  ? ErrorStringNotLiteral
  : [AnalyzeLiteral<$S>] extends [never]
    ? ErrorMalformedLiteral<$S>
    : [FromTargetLiteral<$S, $Target>] extends [never]
      ? ErrorPathValidation<$Target, $S>
      : $S
