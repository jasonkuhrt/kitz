import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { AbsDir } from './AbsDir.js'
import { Statics } from './core.js'

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`). The binding **is** the union string
 * codec (usable directly as a schema) and carries the codec statics (`is`,
 * `fromString`, `encode`/`decode`, …) via {@link Statics.Codec}.
 */
// Pin the inner union to a compact, named codec type so declaration emit references it
// instead of inlining each member's statics intersection (which overflows — TS7056).
const schema: S.Codec<AbsFile | AbsDir, string, never, never> = S.Union([AbsFile, AbsDir])
export const Abs = Statics.Codec(S.asClass(schema))
export type Abs = typeof Abs.Type
