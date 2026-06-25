import { Schema as S } from 'effect'
import { RelFile } from './RelFile.js'
import { RelDir } from './RelDir.js'

/**
 * `Rel` — any relative path (`RelFile | RelDir`), as a `string` ⇄ value codec.
 *
 * Annotated to a compact named codec type so declaration emit references it instead of
 * inlining each member (which overflows — TS7056).
 */
export const Rel: S.Codec<RelFile | RelDir, string, never, never> = S.Union([RelFile, RelDir])
export type Rel = typeof Rel.Type
