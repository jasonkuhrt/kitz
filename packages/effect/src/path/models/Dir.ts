import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'

/**
 * `Dir` — any directory path (`AbsDir | RelDir`), as a `string` ⇄ value codec.
 */
export const Dir = S.Union([AbsDir, RelDir])
export type Dir = typeof Dir.Type
