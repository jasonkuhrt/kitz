import { Schema as S } from 'effect'
import { RelFile } from './RelFile.js'
import { RelDir } from './RelDir.js'
import { asClassPath } from './core.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`). The binding **is** the union string
 * codec (usable directly as a schema) and carries `is` / `fromString` via
 * {@link asClassPath}.
 *
 * @example
 * ```ts
 * const p = Rel.fromString('…')
 * ```
 */
export const Rel = asClassPath(S.Union([RelFile, RelDir]))
export type Rel = typeof Rel.Type
