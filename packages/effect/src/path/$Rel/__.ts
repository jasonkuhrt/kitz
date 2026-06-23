import { Schema as S } from 'effect'
import { RelDir } from '../RelDir/_.js'
import { RelFile } from '../RelFile/_.js'

/**
 * `$Rel` — any relative path (`RelFile | RelDir`).
 *
 * The binding **is** the union string codec, usable directly as a schema —
 * `S.Struct({ p: $Rel })`, `S.decodeSync($Rel)(…)` — with no `.Schema` hop, and
 * carries `is` as a static.
 *
 * @example
 * ```ts
 * const p1 = S.decodeSync($Rel)('./file.txt')  // RelFile
 * const p2 = S.decodeSync($Rel)('./src/')      // RelDir
 * const ConfigSchema = S.Struct({ path: $Rel })
 * ```
 */
class $RelCodec extends S.asClass(S.Union([RelFile, RelDir]).annotate({ identifier: '$Rel' })) {
  /** Type guard for any relative path. */
  static is = S.is(this)
}

export const $Rel = $RelCodec
export type $Rel = S.Schema.Type<typeof $RelCodec>
