import { Schema as S } from 'effect'
import { AbsFile } from '../AbsFile/_.js'
import { RelFile } from '../RelFile/_.js'

/**
 * `$File` — any file path (`AbsFile | RelFile`).
 *
 * The binding **is** the union string codec, usable directly as a schema —
 * `S.Struct({ p: $File })`, `S.decodeSync($File)(…)` — with no `.Schema` hop, and
 * carries `is` as a static.
 *
 * @example
 * ```ts
 * const p1 = S.decodeSync($File)('/home/file.txt')  // AbsFile
 * const p2 = S.decodeSync($File)('./file.txt')      // RelFile
 * const ConfigSchema = S.Struct({ file: $File })
 * ```
 */
class $FileCodec extends S.asClass(S.Union([AbsFile, RelFile]).annotate({ identifier: '$File' })) {
  /** Type guard for any file path. */
  static is = S.is(this)
}

export const $File = $FileCodec
export type $File = S.Schema.Type<typeof $FileCodec>
