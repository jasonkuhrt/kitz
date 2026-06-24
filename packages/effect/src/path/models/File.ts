import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { RelFile } from './RelFile.js'

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
class File_ extends S.asClass(S.Union([AbsFile, RelFile])) {
  /** Type guard for any file path. */
  static is = S.is(this)
}

export const File = File_
export type File = typeof File_.Type
