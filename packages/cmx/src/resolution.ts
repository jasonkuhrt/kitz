import type { Effect } from 'effect'
import type { Choice, AcceptedToken } from './choice.js'

/** Runtime state of a slot during resolution. */
export interface SlotState {
  readonly name: string
  readonly kind: 'Enum' | 'Fuzzy' | 'Search' | 'Text'
  readonly value: unknown | null
  readonly required: boolean
  /** The query that was active when this slot's value was taken. Restored on undo. */
  readonly preTakeQuery?: string | undefined
}

/** The state snapshot returned by every handleKey result that carries resolution data. */
export interface Resolution {
  readonly mode: 'flat' | 'tree'
  readonly acceptedTokens: ReadonlyArray<AcceptedToken>
  readonly query: string
  readonly _tag: 'Leaf' | 'Namespace' | 'Hybrid' | 'None'
  readonly executable: boolean
  readonly effect: Effect.Effect<void, unknown, unknown> | null
  readonly complete: boolean
  readonly topChoice: Choice | null
  readonly choices: ReadonlyArray<Choice>
  readonly choicesLoading: boolean
  readonly slots: ReadonlyArray<SlotState>
  readonly focusedSlot: string | null
}

/** Create an empty initial resolution state. */
export const emptyResolution = (choices: ReadonlyArray<Choice>): Resolution => ({
  mode: 'flat',
  acceptedTokens: [],
  query: '',
  _tag: 'None',
  executable: false,
  effect: null,
  complete: false,
  topChoice: choices.length > 0 ? choices[0]! : null,
  choices,
  choicesLoading: false,
  slots: [],
  focusedSlot: null,
})
