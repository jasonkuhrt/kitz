import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'
import { asClassPath } from './core.js'

/**
 * `Dir` — any directory path (`AbsDir | RelDir`). The binding **is** the union string
 * codec (usable directly as a schema) and carries `is` / `fromString` via
 * {@link asClassPath}.
 *
 * @example
 * ```ts
 * const p = Dir.fromString('…')
 * ```
 */
export const Dir = asClassPath(S.Union([AbsDir, RelDir]))
export type Dir = typeof Dir.Type
