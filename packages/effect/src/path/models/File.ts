import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { RelFile } from './RelFile.js'
import { asClassPath } from './core.js'

/**
 * `File` — any file path (`AbsFile | RelFile`). The binding **is** the union string
 * codec (usable directly as a schema) and carries `is` / `fromString` via
 * {@link asClassPath}.
 *
 * @example
 * ```ts
 * const p = File.fromString('…')
 * ```
 */
export const File = asClassPath(S.Union([AbsFile, RelFile]))
export type File = typeof File.Type
