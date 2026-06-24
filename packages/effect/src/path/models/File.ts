import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { RelFile } from './RelFile.js'
import { Statics } from './core.js'

/**
 * `File` — any file path (`AbsFile | RelFile`). The binding **is** the union string
 * codec (usable directly as a schema) and carries the codec statics (`is`,
 * `fromString`, `encode`/`decode`, …) via {@link Statics.Codec}.
 */
export const File = Statics.Codec(S.asClass(S.Union([AbsFile, RelFile])))
export type File = typeof File.Type
