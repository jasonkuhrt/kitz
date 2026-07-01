import { Schema as S } from 'effect'
import { Abs } from '../models/Abs.js'
import { Any } from '../models/Any.js'
import { Protocol } from '../models/Protocol.js'

/** The `file://` scheme prefix, encoded from the {@link Protocol} codec. */
const fileScheme = S.encodeSync(Protocol)('file')

/**
 * Convert an absolute path to a `file://` URL.
 *
 * Uses the `URL` constructor for portability (Node, Bun, browsers); kitz paths
 * are POSIX-only, so the Windows handling of `pathToFileURL` is unnecessary.
 *
 * @example
 * ```ts
 * toFileUrl(AbsFile '/home/user/file.ts').href // 'file:///home/user/file.ts'
 * ```
 */
export const toFileUrl = (path: Abs): URL => new URL(`${fileScheme}${S.encodeSync(Any)(path)}`)
