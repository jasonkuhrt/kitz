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

type Separator = '/'
type Here = '.'
type Ascent = '..'

type IsAbsolute<$S extends string> = $S extends `${Separator}${string}` ? true : false

type IsDirectorySyntax<$S extends string> = $S extends Here | './' | Ascent | '../'
  ? true
  : $S extends `${string}${Separator}`
    ? true
    : false

type StripRoot<$S extends string> = $S extends `${Separator}${infer $Rest}` ? $Rest : $S

type StripLeadingAscent<$S extends string> = $S extends `../${infer $Rest}`
  ? StripLeadingAscent<$Rest>
  : $S

type StripLeadingHere<$S extends string> = $S extends `./${infer $Rest}` ? $Rest : $S

type Split<$S extends string, $Acc extends readonly string[] = []> = $S extends ''
  ? $Acc
  : $S extends `${infer $Segment}${Separator}${infer $Rest}`
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
  ? $Segment extends Ascent
    ? $Acc extends readonly [...infer $Prefix extends readonly string[], string]
      ? NormalizeSegments<$Rest, $Prefix>
      : NormalizeSegments<$Rest, $Acc>
    : $Segment extends Here | ''
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

type IsValidFileName<$S extends string> = $S extends '' | Here | Ascent ? false : true

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

type TargetDescription<$Target> =
  IsExactly<$Target, AbsFile> extends true
    ? 'an absolute file path'
    : IsExactly<$Target, AbsDir> extends true
      ? 'an absolute directory path'
      : IsExactly<$Target, RelFile> extends true
        ? 'a relative file path'
        : IsExactly<$Target, RelDir> extends true
          ? 'a relative directory path'
          : IsExactly<$Target, Abs> extends true
            ? 'an absolute path'
            : IsExactly<$Target, Rel> extends true
              ? 'a relative path'
              : IsExactly<$Target, File> extends true
                ? 'a file path'
                : IsExactly<$Target, Dir> extends true
                  ? 'a directory path'
                  : 'a path literal matching the target path type'

type ValidationHint<$Target> =
  IsExactly<$Target, AbsFile> extends true
    ? 'Absolute file literals must start with / and must not be root, current/parent-only, trailing slash, or normalize to an invalid filename.'
    : IsExactly<$Target, AbsDir> extends true
      ? 'Absolute directory literals must start with /. Trailing slash is optional for explicit directory targets.'
      : IsExactly<$Target, RelFile> extends true
        ? 'Relative file literals must not start with / and must not be current/parent-only, trailing slash, or normalize to an invalid filename.'
        : IsExactly<$Target, RelDir> extends true
          ? 'Relative directory literals must not start with /. Trailing slash is optional for explicit directory targets.'
          : IsExactly<$Target, Abs> extends true
            ? 'Absolute path literals must start with /.'
            : IsExactly<$Target, Rel> extends true
              ? 'Relative path literals must not start with /.'
              : IsExactly<$Target, File> extends true
                ? 'File literals must not be current/parent-only, trailing slash, or normalize to an invalid filename.'
                : IsExactly<$Target, Dir> extends true
                  ? 'Directory literals may be absolute or relative. Trailing slash is optional for explicit directory targets.'
                  : 'Use one of AbsFile, AbsDir, RelFile, RelDir, Abs, Rel, File, or Dir as the target.'

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
export type ErrorStringNotLiteral =
  StaticError<'Path literal constructors require a string literal. Use a path schema codec for dynamic strings, or decode the target schema at runtime.'>

/** Static error for a literal the path grammar itself rejects, naming the cause. */
export type ErrorMalformedLiteral<$Received extends string> = $Received extends ''
  ? StaticError<'The empty string is not a path literal.'>
  : StaticError<`Path literal '${$Received}' is not a valid path literal.`>

/** Static error for path values from different anchoring groups. */
export type ErrorPathGroupMismatch =
  StaticError<'Path arguments must share a group: both absolute or both relative.'>

type IsValidSegmentLiteral<$S extends string> = $S extends '' | Here | Ascent
  ? false
  : $S extends `${string}${Separator}${string}` | `${string}\0${string}`
    ? false
    : true

type ErrorMalformedSegmentLiteral<$Received extends string> = $Received extends ''
  ? StaticError<'Path segment literals cannot be empty.'>
  : $Received extends Here | Ascent
    ? StaticError<`Path segment literal '${$Received}' is a traversal reference, not a segment name.`>
    : $Received extends `${string}${Separator}${string}`
      ? StaticError<`Path segment literal '${$Received}' cannot contain '/'.`>
      : StaticError<'Path segment literals cannot contain NUL.'>

/** Guard a POSIX path-segment literal against the runtime Segment grammar. */
export type SegmentLiteralGuard<$S extends string> = string extends $S
  ? StaticError<'Segment literal constructors require a string literal. Decode dynamic strings through Path.Segment.'>
  : IsValidSegmentLiteral<$S> extends true
    ? $S
    : ErrorMalformedSegmentLiteral<$S>

/** Static error for a well-formed literal that does not match the target path schema. */
export type ErrorPathValidation<$Target, $Received> =
  StaticError<`Path literal '${$Received & string}' is not ${TargetDescription<$Target>}. ${ValidationHint<$Target>}`>

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
