import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { AbsDir } from './AbsDir.js'

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`), as a `string` ⇄ value codec.
 *
 * Annotated to a compact named codec type so declaration emit references it instead of
 * inlining each member (which overflows — TS7056).
 */
export const Abs: S.Codec<AbsFile | AbsDir, string, never, never> = S.Union([AbsFile, AbsDir])
export type Abs = typeof Abs.Type
