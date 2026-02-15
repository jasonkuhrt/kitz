import { Schema as S } from 'effect'
import { Candidate } from './item-candidate.js'
import { Ephemeral } from './item-ephemeral.js'
import { Official } from './item-official.js'

/**
 * A plan item - discriminated union of release types.
 */
export type Item = Official | Candidate | Ephemeral

/**
 * Schema for Item union (used for serialization).
 */
export const ItemSchema = S.Union(Official, Candidate, Ephemeral)
