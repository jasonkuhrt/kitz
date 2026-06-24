import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { AbsDir } from './AbsDir.js'
import { Statics } from './core.js'

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`). The binding **is** the union string
 * codec (usable directly as a schema) and carries the codec statics (`is`,
 * `fromString`, `encode`/`decode`, …) via {@link Statics.Codec}.
 */
export const Abs = Statics.Codec(S.asClass(S.Union([AbsFile, AbsDir])))
export type Abs = typeof Abs.Type
