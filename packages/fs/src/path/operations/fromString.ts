import { Schema as S } from 'effect'
import type { Path } from '../_.js'
import type { normalize } from '../inputs.js'
import { Schema } from '../Schema.js'

/**
 * Decode a string literal to the appropriate Path type.
 * Type is inferred at compile time when using string literals.
 *
 * This provides compile-time type inference magic based on the string literal shape.
 *
 * @example
 * ```ts
 * const path1 = fromLiteral('/home/user/file.txt')  // AbsFile
 * const path2 = fromLiteral('./src/')               // RelDir
 * ```
 */
export const fromLiteral = <const $input extends string>(
  $input: $input,
): normalize<$input> => S.decodeSync(Schema)($input) as any

/**
 * Decode a string to the appropriate Path type.
 *
 * When called with a string literal, the specific path type is inferred:
 * - `./.release/` → RelDir (starts with `./`, ends with `/`)
 * - `./config.json` → RelFile (starts with `./`, has extension)
 * - `/home/user/` → AbsDir (starts with `/`, ends with `/`)
 * - `/home/user/config.json` → AbsFile (starts with `/`, has extension)
 *
 * When called with a plain `string`, returns the union type `Path`.
 *
 * @example
 * ```ts
 * // Literal strings infer specific types
 * const dir = fromString('./.release/')        // RelDir
 * const file = fromString('./config.json')     // RelFile
 *
 * // Runtime strings return Path union
 * const path = fromString(someVariable)        // Path
 * ```
 */
export const fromString = <const $input extends string>(
  $input: $input,
): normalize<$input> => S.decodeSync(Schema)($input) as any
