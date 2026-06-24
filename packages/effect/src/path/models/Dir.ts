import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'
import { Statics } from './core.js'

/**
 * `Dir` — any directory path (`AbsDir | RelDir`). The binding **is** the union string
 * codec (usable directly as a schema) and carries the codec statics (`is`,
 * `fromString`, `encode`/`decode`, …) via {@link Statics.Codec}.
 */
export const Dir = Statics.Codec(S.asClass(S.Union([AbsDir, RelDir])))
export type Dir = typeof Dir.Type
