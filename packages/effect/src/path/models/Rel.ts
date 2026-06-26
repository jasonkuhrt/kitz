import { Schema as S } from 'effect'
import { RelFile } from './RelFile.js'
import { RelDir } from './RelDir.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`), as a `string` ⇄ value codec.
 */
export const Rel = S.Union([RelFile, RelDir])
export type Rel = typeof Rel.Type
