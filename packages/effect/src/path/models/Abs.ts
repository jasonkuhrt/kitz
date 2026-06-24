import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { AbsDir } from './AbsDir.js'
import { asClassPath } from './core.js'

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`). The binding **is** the union string
 * codec (usable directly as a schema) and carries `is` / `fromString` via
 * {@link asClassPath}.
 *
 * @example
 * ```ts
 * const p = Abs.fromString('…')
 * ```
 */
export const Abs = asClassPath(S.Union([AbsFile, AbsDir]))
export type Abs = typeof Abs.Type
