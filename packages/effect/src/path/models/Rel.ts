import { Schema as S } from 'effect'
import { RelFile } from './RelFile.js'
import { RelDir } from './RelDir.js'
import { Statics } from './core.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`). The binding **is** the union string
 * codec (usable directly as a schema) and carries the codec statics (`is`,
 * `fromString`, `encode`/`decode`, …) via {@link Statics.Codec}.
 */
export const Rel = Statics.Codec(S.asClass(S.Union([RelFile, RelDir])))
export type Rel = typeof Rel.Type
