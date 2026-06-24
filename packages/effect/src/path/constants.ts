import { AbsDir } from './models/AbsDir.js'
import { RelDir } from './models/RelDir.js'

export const stringSeparator = '/'

/**
 * Root directory constant (/)
 */
export const absDirRoot = () => AbsDir.fromString('/')

/**
 * Current directory constant (./)
 */
export const relDirCurrent = () => RelDir.fromString('./')

/**
 * Parent directory constant (../)
 */
export const relDirParent = () => RelDir.fromString('../')
