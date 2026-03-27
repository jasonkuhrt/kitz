import type { Semver } from '@kitz/semver'
import { type Option, Schema as S } from 'effect'
import type { ReleaseCommit } from '../../analyzer/models/commit.js'
import type { Package } from '../../analyzer/workspace.js'
import { Candidate } from './item-candidate.js'
import { Ephemeral } from './item-ephemeral.js'
import { Official } from './item-official.js'

/**
 * Shared interface for all plan item types.
 *
 * Every plan item (Official, Candidate, Ephemeral) provides these
 * computed properties regardless of lifecycle type, enabling
 * lifecycle-agnostic rendering and execution.
 */
export interface ItemLike {
  readonly package: Package
  readonly commits: readonly ReleaseCommit[]
  /** The version this release will produce. */
  readonly nextVersion: Semver.Semver
  /** The current version, if a previous release exists. */
  readonly currentVersion: Option.Option<Semver.Semver>
  /** The bump type (official only; undefined for candidate/ephemeral). */
  readonly bumpType: Semver.BumpType | undefined
}

/**
 * A plan item - discriminated union of release types.
 *
 * All variants satisfy {@link ItemLike}, which provides lifecycle-agnostic
 * access to `nextVersion`, `currentVersion`, and `bumpType`.
 */
export type Item = Official | Candidate | Ephemeral

/**
 * Schema for Item union (used for serialization).
 */
export const ItemSchema = S.Union([Official, Candidate, Ephemeral]).pipe(S.toTaggedUnion('_tag'))
export type ItemSchema = typeof ItemSchema.Type

export namespace ItemSchema {
  export type Official = import('./item-official.js').Official
  export type Candidate = import('./item-candidate.js').Candidate
  export type Ephemeral = import('./item-ephemeral.js').Ephemeral
}
