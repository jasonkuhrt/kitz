import { Schema as S } from 'effect'
import { RelFile } from './RelFile.js'
import { RelDir } from './RelDir.js'
import { Statics } from './core.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`). The binding **is** the union string
 * codec (usable directly as a schema) and carries the codec statics (`is`,
 * `fromString`, `encode`/`decode`, …) via {@link Statics.Codec}.
 */
// Pin the inner union to a compact, named codec type so declaration emit references it
// instead of inlining each member's statics intersection (which overflows — TS7056).
const schema: S.Codec<RelFile | RelDir, string, never, never> = S.Union([RelFile, RelDir])
export const Rel = Statics.Codec(S.asClass(schema))
export type Rel = typeof Rel.Type
