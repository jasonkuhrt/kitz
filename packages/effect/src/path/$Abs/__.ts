import { Schema as S } from 'effect'
import { AbsDir } from '../AbsDir/_.js'
import { AbsFile } from '../AbsFile/_.js'

/**
 * `$Abs` — any absolute path (`AbsFile | AbsDir`).
 *
 * The binding **is** the union string codec, usable directly as a schema —
 * `S.Struct({ p: $Abs })`, `S.decodeSync($Abs)(…)` — with no `.Schema` hop, and
 * carries `is` as a static.
 *
 * @example
 * ```ts
 * const p1 = S.decodeSync($Abs)('/home/user/file.txt')  // AbsFile
 * const p2 = S.decodeSync($Abs)('/home/user/')          // AbsDir
 * const ConfigSchema = S.Struct({ path: $Abs })
 * ```
 */
class $AbsCodec extends S.asClass(S.Union([AbsFile, AbsDir]).annotate({ identifier: '$Abs' })) {
  /** Type guard for any absolute path. */
  static is = S.is(this)
}

export const $Abs = $AbsCodec
export type $Abs = S.Schema.Type<typeof $AbsCodec>
