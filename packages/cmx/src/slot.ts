import type { Schema } from 'effect'
import type { Effect } from 'effect'

/** Shared documentation fields for all slot kinds. */
interface SlotDocumentation {
  /** Short label shown when the slot is focused. */
  readonly description?: string
  /** Longer explanation for preview panes. */
  readonly detail?: string
  /** Hint text shown in the input area when the slot has no value yet. */
  readonly placeholder?: string
  /** Whether the slot must be filled before execution. Default: true. */
  readonly required?: boolean
}

/** A candidate value for a slot, typed by the slot's schema. */
export interface SlotCandidate<V> {
  readonly value: V
  readonly label: string
  readonly description?: string
}

/** Static candidates derived from Schema. Matched like commands. */
export interface SlotEnum<A = unknown> extends SlotDocumentation {
  readonly _tag: 'Enum'
  readonly name: string
  readonly schema: Schema.Schema<A>
}

/** Source provides candidates, Matcher matches client-side. */
export interface SlotFuzzy<A = unknown> extends SlotDocumentation {
  readonly _tag: 'Fuzzy'
  readonly name: string
  readonly schema: Schema.Schema<A>
  readonly source: Effect.Effect<ReadonlyArray<SlotCandidate<A>>, never, never>
}

/** Source handles matching server-side. */
export interface SlotSearch<A = unknown> extends SlotDocumentation {
  readonly _tag: 'Search'
  readonly name: string
  readonly schema: Schema.Schema<A>
  readonly source: (query: string) => Effect.Effect<ReadonlyArray<SlotCandidate<A>>, never, never>
}

/** Free-form text input. Schema validates on submit. */
export interface SlotText<A = unknown> extends SlotDocumentation {
  readonly _tag: 'Text'
  readonly name: string
  readonly schema: Schema.Schema<A>
}

/** Any slot kind. */
export type AnySlot = SlotEnum | SlotFuzzy | SlotSearch | SlotText

export const Slot = {
  Enum: {
    make: <A>(config: Omit<SlotEnum<A>, '_tag'>): SlotEnum<A> => ({
      _tag: 'Enum',
      ...config,
    }),
  },
  Fuzzy: {
    make: <A>(config: Omit<SlotFuzzy<A>, '_tag'>): SlotFuzzy<A> => ({
      _tag: 'Fuzzy',
      ...config,
    }),
  },
  Search: {
    make: <A>(config: Omit<SlotSearch<A>, '_tag'>): SlotSearch<A> => ({
      _tag: 'Search',
      ...config,
    }),
  },
  Text: {
    make: <A>(config: Omit<SlotText<A>, '_tag'>): SlotText<A> => ({
      _tag: 'Text',
      ...config,
    }),
  },
} as const
