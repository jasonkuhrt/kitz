import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'

/**
 * `Dir` — any directory path (`AbsDir | RelDir`). The binding **is** the union string
 * codec (usable directly as a schema) and carries the codec statics (`is`,
 * `fromString`, `encode`/`decode`, …) via {@link Statics.Codec}.
 */
// Pin the inner union to a compact, named codec type so declaration emit references it
// instead of inlining each member's statics intersection (which overflows — TS7056).
const schema: S.Codec<AbsDir | RelDir, string, never, never> = S.Union([AbsDir, RelDir])
export const Dir = schema
export type Dir = typeof Dir.Type
