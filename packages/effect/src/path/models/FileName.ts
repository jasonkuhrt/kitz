import { Effect, flow, Option, Result, Schema as S, SchemaGetter } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import type { Types } from '../../types/_.js'
import { analyzeFileName, splitExtension } from '../analyzer.js'
import { ascent, here, nullByte } from '../core/grammar.js'
import type { separator } from '../core/grammar.js'
import type { requiresLiteral } from '../core/messages.js'
import { Extension } from './Extension.js'

/**
 * A filename stem: non-empty, well-formed text without `/` or NUL. Dots are
 * allowed anywhere; which stems a filename can have also depends on its
 * extension (see {@link isCanonicalSplit}). The pattern's `u` flag lets
 * pattern-derived generation emit astral characters.
 */
const Stem = S.String.pipe(
  S.check(
    S.isNonEmpty({ message: 'Filename stem cannot be empty' }),
    S.isPattern(new RegExp(`^[^/${nullByte}]+$`, 'u'), {
      message: 'Filename stem cannot contain / or NUL',
    }),
    S.makeFilter((s) => s.isWellFormed(), { message: 'Filename stem must be well-formed Unicode' }),
  ),
)

/** A filename's final extension: an {@link Extension} with no further dot, since the split is at the last dot. */
const FinalExtension = Extension.pipe(
  S.check(
    S.makeFilter((s) => s.lastIndexOf('.') === 0, {
      message: 'A final extension cannot contain a further dot',
    }),
  ),
)

/**
 * Whether the parts are the canonical split of their rendered name. With an
 * extension, the field invariants already put the split at the extension's
 * dot. Without one, the stem is the whole name, so it must be a valid name that
 * {@link splitExtension} leaves whole: not `.` or `..`, and no dot after
 * index 0 other than a final one.
 */
const isCanonicalSplit = (parts: {
  readonly stem: string
  readonly extension: Option.Option<string>
}): boolean =>
  Option.isSome(parts.extension) ||
  (parts.stem !== here && parts.stem !== ascent && splitExtension(parts.stem).extension === null)

const splitExtensions = (
  name: string,
): { readonly prefix: string; readonly extensions: ReadonlyArray<Extension> } => {
  const extensions: Extension[] = []
  let prefix = name

  while (true) {
    const split = splitExtension(prefix)
    if (split.extension === null) return { prefix, extensions }
    extensions.unshift(Extension.make(split.extension))
    prefix = split.stem
  }
}

/**
 * Filename value — a stem plus optional final extension, split on the last dot
 * after index 0. The fields and their check admit exactly the canonical splits
 * of valid filenames, so every value of this type, including every value
 * derived by `Arbitrary.schema`, renders to a name that decodes back to it.
 */
class FileName__ extends S.TaggedClass<FileName__>('@kitz/effect/Path/FileName')(
  'FileName',
  S.Struct({
    stem: Stem,
    extension: S.OptionFromNullOr(FinalExtension),
  }).check(
    S.makeFilter(isCanonicalSplit, {
      message:
        'Filename parts must be the canonical split of a valid name: not "." or "..", with any extension starting at the last dot after index 0',
    }),
  ),
) {
  /** The rendered `stem(.ext)?` string form. */
  get name(): string {
    return Option.match(this.extension, {
      onNone: () => this.stem,
      onSome: (extension) => `${this.stem}${extension}`,
    })
  }

  /**
   * The portion before the first non-leading extension boundary, matching
   * Rust's `Path::file_prefix` for ordinary names and dotfiles. A trailing dot
   * remains part of this extensionless prefix, as required by FileName grammar.
   */
  get prefix(): string {
    return splitExtensions(this.name).prefix
  }

  /** The full left-to-right extension chain, with each leading dot preserved. */
  get extensions(): ReadonlyArray<Extension> {
    return splitExtensions(this.name).extensions
  }
}

type FileNameParts = {
  readonly stem: string
  readonly extension: Option.Option<Extension>
}

/**
 * `FileName` — a bare filename as a `string` ⇄ `{ stem, extension }` codec.
 *
 * @example
 * ```ts
 * const name = FileName.make({ stem: 'index', extension: Option.some('.ts') })
 * ```
 */
export class FileName_ extends withStatics(
  S.String.pipe(
    S.decodeTo(FileName__, {
      encode: SchemaGetter.transform((encoded) =>
        encoded.extension === null ? encoded.stem : `${encoded.stem}${encoded.extension}`,
      ),
      decode: SchemaGetter.transformEffect(
        flow(
          analyzeFileName,
          Result.map((file) => ({
            _tag: 'FileName' as const,
            stem: file.stem,
            extension: file.extension,
          })),
          Effect.fromResult,
        ),
      ),
    }),
  ),
) {
  /**
   * Construct a canonical `FileName` from a literal, widened string, or parts.
   * String literals are validated statically; widened strings validate at
   * runtime. Parts are re-joined and re-split on the last dot — the same rule
   * the string codec applies — so a non-canonical input like `{ stem: 'a.txt',
   * extension: none }` normalizes to `{ stem: 'a', extension: '.txt' }`.
   */
  static override make<const $Input extends string>(input: FileNameMakeInput<$Input>): FileName
  static override make(input: FileNameParts): FileName__
  static override make(input: string | FileNameParts): FileName__ {
    if (typeof input === 'string') return S.decodeSync(FileName_)(input)
    const full = `${input.stem}${Option.getOrElse(input.extension, () => '')}`
    const decoded = S.decodeSync(FileName_)(full)
    return super.make({ stem: decoded.stem, extension: decoded.extension })
  }
}

export const FileName = FileName_
export type FileName = typeof FileName_.Type

type FileNameMakeInput<$Input extends string> =
  Types.IsLiteral<$Input> extends true ? FileNameLiteralGuard<$Input, 'Path.FileName.make'> : $Input

type IsValidFileNameLiteral<$S extends string> = $S extends '' | '.' | '..'
  ? false
  : $S extends `${string}${separator}${string}` | `${string}${nullByte}${string}`
    ? false
    : true

type ErrorMalformedFileNameLiteral<$Received extends string> = $Received extends ''
  ? Types.StaticError<'Filename literals cannot be empty.'>
  : $Received extends '.' | '..'
    ? Types.StaticError<'Filename literals cannot be traversal references.'>
    : $Received extends `${string}${separator}${string}`
      ? Types.StaticError<`Filename literal '${$Received}' cannot contain '/'.`>
      : Types.StaticError<'Filename literals cannot contain NUL.'>

/** Guard a bare-filename literal against the runtime FileName grammar. */
export type FileNameLiteralGuard<$S extends string, $Subject extends string> =
  Types.IsLiteral<$S> extends true
    ? IsValidFileNameLiteral<$S> extends true
      ? $S
      : ErrorMalformedFileNameLiteral<$S>
    : Types.StaticError<
        requiresLiteral<
          $Subject,
          's',
          'Use a widened string for runtime validation through Path.FileName.'
        >
      >
