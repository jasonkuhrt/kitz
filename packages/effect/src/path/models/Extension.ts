import { Schema as S } from 'effect'
import { withStatics } from '../../schema/withStatics.js'
import type { Types } from '../../types/_.js'
import { nullByte } from '../core/grammar.js'
import type { requiresLiteral } from '../core/messages.js'

/**
 * A file extension starting with a dot (e.g. `.ts`). POSIX-safe: any
 * character except `/` or NUL after the dot, as well-formed Unicode like all
 * path text. The pattern's `u` flag lets pattern-derived generation emit astral
 * characters.
 */
const ExtensionSchema = S.String.pipe(
  S.check(
    S.isPattern(new RegExp(`^\\.[^/${nullByte}]+$`, 'u')),
    S.makeFilter((s) => s.isWellFormed(), { message: 'Extension must be well-formed Unicode' }),
  ),
  S.annotate({ description: 'A file extension starting with a dot (POSIX-compliant)' }),
)

type IsValidExtensionLiteral<$S extends string> = $S extends `.${infer $Rest}`
  ? $Rest extends ''
    ? false
    : $Rest extends `${string}/${string}` | `${string}\0${string}`
      ? false
      : true
  : false

type ErrorMalformedExtensionLiteral<$Received extends string> = $Received extends `.${infer $Rest}`
  ? $Rest extends ''
    ? Types.StaticError<'Extension literals require at least one character after the dot.'>
    : $Rest extends `${string}/${string}`
      ? Types.StaticError<`Extension literal '${$Received}' cannot contain '/'.`>
      : Types.StaticError<'Extension literals cannot contain NUL.'>
  : Types.StaticError<`Extension literal '${$Received}' must start with '.'.`>

/** Guard a literal against the Extension runtime grammar. */
export type ExtensionLiteralGuard<$S extends string, $Subject extends string> =
  Types.IsLiteral<$S> extends true
    ? IsValidExtensionLiteral<$S> extends true
      ? $S
      : ErrorMalformedExtensionLiteral<$S>
    : Types.StaticError<
        requiresLiteral<
          $Subject,
          's',
          'Use a widened string for runtime validation through Path.Extension.'
        >
      >

/** First-class file-extension schema with a literal-aware constructor. */
export class Extension_ extends withStatics(ExtensionSchema) {
  /** Literals validate statically; widened strings validate at runtime. */
  static override make<const $Input extends string>(
    input: ExtensionMakeInput<$Input>,
    options?: S.MakeOptions,
  ): Extension {
    return super.make(input as any, options)
  }
}

export const Extension = Extension_
export type Extension = typeof Extension_.Type

type ExtensionMakeInput<$Input extends string> =
  Types.IsLiteral<$Input> extends true
    ? ExtensionLiteralGuard<$Input, 'Path.Extension.make'>
    : $Input
