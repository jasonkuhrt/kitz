import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { RelFile } from './RelFile.js'
import { Statics } from './core.js'

/**
 * `File` — any file path (`AbsFile | RelFile`). The binding **is** the union string
 * codec (usable directly as a schema) and carries the codec statics (`is`,
 * `fromString`, `encode`/`decode`, …) via {@link Statics.Codec}.
 */
// Pin the inner union to a compact, named codec type so declaration emit references it
// instead of inlining each member's statics intersection (which overflows — TS7056).
const schema: S.Codec<AbsFile | RelFile, string, never, never> = S.Union([AbsFile, RelFile])
export const File = Statics.Codec(S.asClass(schema))
export type File = typeof File.Type
