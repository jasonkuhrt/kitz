import { Schema as S } from 'effect'
import { Schema } from '../Schema.js'

/**
 * Encode a Path instance to its string representation.
 *
 * @example
 * ```ts
 * const path = Path.AbsDir.fromString('/home/user/')
 * const str = Path.toString(path)  // '/home/user/'
 * ```
 */
export const toString = S.encodeSync(Schema)
