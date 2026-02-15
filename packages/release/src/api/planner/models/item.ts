import { Schema as S } from 'effect'
import { Pr } from './item-pr.js'
import { Preview } from './item-preview.js'
import { Stable } from './item-stable.js'

/**
 * A plan item - discriminated union of release types.
 */
export type Item = Stable | Preview | Pr

/**
 * Schema for Item union (used for serialization).
 */
export const ItemSchema = S.Union(Stable, Preview, Pr)
