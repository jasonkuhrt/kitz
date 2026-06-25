import { Schema as S } from 'effect'
import { AbsDir } from './AbsDir.js'
import { RelDir } from './RelDir.js'

/**
 * `Dir` — any directory path (`AbsDir | RelDir`), as a `string` ⇄ value codec.
 *
 * Annotated to a compact named codec type so declaration emit references it instead of
 * inlining each member (which overflows — TS7056).
 */
export const Dir: S.Codec<AbsDir | RelDir, string, never, never> = S.Union([AbsDir, RelDir])
export type Dir = typeof Dir.Type
