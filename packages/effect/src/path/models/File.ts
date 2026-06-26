import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { RelFile } from './RelFile.js'

/**
 * `File` — any file path (`AbsFile | RelFile`), as a `string` ⇄ value codec.
 */
export const File = S.Union([AbsFile, RelFile])
export type File = typeof File.Type
