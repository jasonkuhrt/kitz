import { Schema as S } from 'effect'
import type { StaticError } from '../../types/staticError.js'

const nullByte = String.fromCharCode(0)
const extensionPatternSource = `^\\.[^/${nullByte}]+$`

/**
 * A file extension starting with a dot (e.g. `.ts`). POSIX-safe: any
 * character except `/` or NUL after the dot.
 */
const ExtensionSchema = S.String.pipe(
  S.check(
    S.isPattern(new RegExp(extensionPatternSource), {
      arbitrary: {
        // Keep the pattern constraint for the base generator (printable
        // ASCII) and add a full-codepoint source at equal weight, keeping
        // canonical generation domain-faithful.
        constraint: { patterns: [extensionPatternSource] },
        candidate: {
          weight: 1,
          make: (fc: typeof import('effect/testing').FastCheck) =>
            fc
              .string({ unit: 'binary', minLength: 1, maxLength: 8 })
              .filter((s) => !s.includes('/') && !s.includes(nullByte))
              .map((s) => `.${s}`),
        },
      },
    }),
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
    ? StaticError<'Extension literals require at least one character after the dot.'>
    : $Rest extends `${string}/${string}`
      ? StaticError<`Extension literal '${$Received}' cannot contain '/'.`>
      : StaticError<'Extension literals cannot contain NUL.'>
  : StaticError<`Extension literal '${$Received}' must start with '.'.`>

/** Guard a literal against the Extension runtime grammar. */
export type ExtensionLiteralGuard<$S extends string> = string extends $S
  ? StaticError<'Extension.mk requires a string literal. Decode dynamic strings through Path.Extension.'>
  : IsValidExtensionLiteral<$S> extends true
    ? $S
    : ErrorMalformedExtensionLiteral<$S>

/** First-class file-extension schema with a literal-only constructor. */
export class Extension_ extends S.asClass(ExtensionSchema) {
  static readonly mk = <const $Input extends string>(
    input: ExtensionLiteralGuard<$Input>,
  ): Extension => S.decodeSync(Extension_)(input as any)
}

export const Extension = Extension_
export type Extension = typeof Extension_.Type
