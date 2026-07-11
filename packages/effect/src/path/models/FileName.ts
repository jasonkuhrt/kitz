import { Effect, flow, Option, Result, Schema as S, SchemaGetter } from 'effect'
import { withArbitraryHints } from '../../schema/withArbitraryHints.js'
import { withStatics } from '../../schema/withStatics.js'
import type { Types } from '../../types/_.js'
import { analyzeFileName } from '../analyzer.js'
import { nullByte } from '../core/grammar.js'
import type { separator } from '../core/grammar.js'
import type { requiresLiteral } from '../core/messages.js'
import {
  realisticDotfilePattern,
  realisticExtensionPattern,
  realisticStemPattern,
} from '../core/realisticText.js'
import { Extension } from './Extension.js'

const fileNameText = new RegExp(
  `^[^/${nullByte}.][^/${nullByte}]{0,31}` +
    `(\\.[^/${nullByte}.][^/${nullByte}]{0,15})?$` +
    `|^\\.[^/${nullByte}.][^/${nullByte}]{0,31}$`,
)

const canGenerateFileName = (name: string): boolean => {
  const result = analyzeFileName(name)
  return (
    Result.isSuccess(result) &&
    (result.success.extension === null || S.is(Extension)(result.success.extension))
  )
}

const unsafeAnalyzeGeneratedFileName = (
  name: string,
): { stem: string; extension: string | null } => {
  const result = analyzeFileName(name)
  if (Result.isFailure(result)) throw new Error('generated invalid filename')
  return result.success
}

const fileNameArbitrary = {
  toArbitrary: () => (fc: typeof import('effect/testing').FastCheck) => {
    // Two equal-weight text sources keep canonical generation domain-faithful:
    // the ASCII pattern generator (fc.stringMatching never leaves printable
    // ASCII — see docs/learnings/effect-arbitrary.md) plus full-codepoint
    // unicode composition. Both funnel through the same analyze/normalize
    // pipeline, so every generated value is a canonical FileName.
    const asciiText = fc.stringMatching(fileNameText)
    const unicodePart = fc
      .string({ unit: 'binary', minLength: 1, maxLength: 16 })
      .filter((s) => s.isWellFormed() && !s.includes('/') && !s.includes(nullByte))
    const unicodeText = fc
      .tuple(unicodePart, fc.option(unicodePart, { nil: undefined }))
      .map(([stem, extension]) => (extension === undefined ? stem : `${stem}.${extension}`))
    return fc
      .oneof(asciiText, unicodeText)
      .filter(canGenerateFileName)
      .map(unsafeAnalyzeGeneratedFileName)
      .map((file) =>
        FileName__.make({
          stem: file.stem,
          extension: Option.fromNullOr(file.extension),
        }),
      )
  },
} satisfies S.Annotations.Bottom<FileName__, readonly []>

/** Filename value — a stem plus optional final extension, split on the last dot after index 0. */
class FileName__ extends S.TaggedClass<FileName__>()('FileName', {
  stem: S.String,
  extension: S.OptionFromNullOr(Extension),
}) {
  /** The rendered `stem(.ext)?` string form. */
  get name(): string {
    return Option.match(this.extension, {
      onNone: () => this.stem,
      onSome: (extension) => `${this.stem}${extension}`,
    })
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
  S.asClass(
    S.String.pipe(
      S.decodeTo(FileName__, {
        encode: SchemaGetter.transform((encoded) =>
          encoded.extension === null ? encoded.stem : `${encoded.stem}${encoded.extension}`,
        ),
        decode: SchemaGetter.transformOrFail(
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
      S.annotate(fileNameArbitrary),
    ),
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

  /**
   * Variant schema carrying a realistic generation bias — same set as the
   * canonical schema; generation mixes realistic `stem(.ext)?` names and
   * dotfiles 20:1 over the canonical distribution.
   */
  static readonly Realistic = FileName_.pipe(
    withArbitraryHints({
      candidate: {
        weight: 20,
        make: (fc) =>
          fc
            .oneof(
              fc
                .tuple(
                  fc.stringMatching(realisticStemPattern),
                  fc.option(fc.stringMatching(realisticExtensionPattern), { nil: undefined }),
                )
                .map(([stem, extension]) => `${stem}${extension ?? ''}`),
              fc.stringMatching(realisticDotfilePattern),
            )
            .filter(canGenerateFileName)
            .map(unsafeAnalyzeGeneratedFileName)
            .map((file) =>
              FileName__.make({
                stem: file.stem,
                extension: Option.fromNullOr(file.extension),
              }),
            ),
      },
    }),
  )
}

export const FileName = FileName_
export type FileName = typeof FileName_.Type

type FileNameMakeInput<$Input extends string> =
  Types.IsLiteral<$Input> extends true ? FileNameLiteralGuard<$Input> : $Input

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
export type FileNameLiteralGuard<$S extends string> =
  Types.IsLiteral<$S> extends true
    ? IsValidFileNameLiteral<$S> extends true
      ? $S
      : ErrorMalformedFileNameLiteral<$S>
    : Types.StaticError<
        requiresLiteral<
          'FileName.make',
          's',
          'Use a widened string for runtime validation through Path.FileName.'
        >
      >
