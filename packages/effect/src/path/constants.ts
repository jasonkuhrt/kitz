import { Schema as S } from 'effect'
import { AbsDir } from './models/AbsDir.js'
import { RelDir } from './models/RelDir.js'

/**
 * Root directory constant (/)
 */
export const absDirRoot = () => S.decodeSync(AbsDir)('/')

/**
 * Current directory constant (./)
 */
export const relDirCurrent = () => S.decodeSync(RelDir)('./')

/**
 * Parent directory constant (../)
 */
export const relDirParent = () => S.decodeSync(RelDir)('../')
