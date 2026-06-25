import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { RelFile } from './RelFile.js'

/**
 * `File` — any file path (`AbsFile | RelFile`), as a `string` ⇄ value codec.
 *
 * Annotated to a compact named codec type so declaration emit references it instead of
 * inlining each member (which overflows — TS7056).
 */
export const File: S.Codec<AbsFile | RelFile, string, never, never> = S.Union([AbsFile, RelFile])
export type File = typeof File.Type
