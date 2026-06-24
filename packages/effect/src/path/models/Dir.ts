import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'

/**
 * `$Dir` — any directory path (`AbsDir | RelDir`).
 *
 * The binding **is** the union string codec, usable directly as a schema —
 * `S.Struct({ p: $Dir })`, `S.decodeSync($Dir)(…)` — with no `.Schema` hop, and
 * carries `is` as a static.
 *
 * @example
 * ```ts
 * const p1 = S.decodeSync($Dir)('/home/user/')  // AbsDir
 * const p2 = S.decodeSync($Dir)('./src/')       // RelDir
 * const ConfigSchema = S.Struct({ dir: $Dir })
 * ```
 */
class Dir_ extends S.asClass(S.Union([AbsDir, RelDir])) {
  /** Type guard for any directory path. */
  static is = S.is(this)
}

export const Dir = Dir_
export type Dir = typeof Dir_.Type
