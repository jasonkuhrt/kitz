import { Schema as S } from 'effect'
import { AbsFile } from './AbsFile.js'
import { AbsDir } from './AbsDir.js'

/**
 * `Abs` — any absolute path (`AbsFile | AbsDir`), as a `string` ⇄ value codec.
 */
export const Abs = S.Union([AbsFile, AbsDir])
export type Abs = typeof Abs.Type
