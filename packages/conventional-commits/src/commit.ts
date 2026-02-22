import { Schema } from 'effect'
import { Multi } from './commit-multi.js'
import { Single } from './commit-single.js'

export { Multi } from './commit-multi.js'
export { Single } from './commit-single.js'

/**
 * A conventional commit—either single (standard CC) or multi (extended for monorepos).
 */
export const Commit = Schema.Union(Single, Multi)

/**
 * Type alias for the Commit union.
 */
export type Commit = typeof Commit.Type
