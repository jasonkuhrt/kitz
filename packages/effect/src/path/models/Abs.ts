import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { AbsFile } from './AbsFile.js'

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
class Abs_ extends S.asClass(S.Union([AbsFile, AbsDir])) {
  /** Type guard for any absolute path. */
  static is = S.is(this)
}

export const Abs = Abs_
export type Abs = typeof Abs_.Type
