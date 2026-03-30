import type { AnySlot, SlotEnum, SlotFuzzy, SlotSearch, SlotText, SlotCandidate } from './slot.js'
import type { Choice } from './choice.js'
import type { SlotState } from './resolution.js'

/** Internal state for the Slot Resolver. */
interface SlotResolverState {
  /** All slots for the current capability. */
  slots: AnySlot[]
  /** Index of the currently focused slot. */
  focusedIndex: number
  /** Filled values keyed by slot name. */
  values: Map<string, { value: unknown; preTakeQuery: string }>
  /** Current query for the focused slot. */
  query: string
  /** Cached candidates for Slot.Fuzzy (loaded lazily). */
  cachedCandidates: Map<string, SlotCandidate<unknown>[]>
  /** Whether a source fetch is in progress. */
  loading: boolean
}

/** Build choices from the focused slot. */
const buildSlotChoices = (state: SlotResolverState): Choice[] => {
  const slot = state.slots[state.focusedIndex]!
  if (!slot) return []

  switch (slot._tag) {
    case 'Enum': {
      // Derive candidates from schema — for Literal schemas, extract the literals
      // This is a simplified version; full implementation would use Schema introspection
      const candidates = getEnumCandidates(slot)
      return filterSlotChoices(candidates, state.query)
    }
    case 'Fuzzy': {
      const cached = state.cachedCandidates.get(slot.name)
      if (!cached) return [] // loading
      return filterSlotChoices(
        cached.map((c) => ({
          token: c.label,
          kind: 'value' as const,
          executable: false,
          description: c.description,
          _value: c.value,
        })),
        state.query,
      )
    }
    case 'Search': {
      // Search candidates come from the source — managed externally
      return []
    }
    case 'Text': {
      // No candidates for text slots
      return []
    }
  }
}

/** Get enum candidates from a Literal schema. */
const getEnumCandidates = (slot: SlotEnum): Choice[] => {
  // Extract literal values from the schema
  // This uses internal Schema structure — simplified for now
  try {
    const ast = (slot.schema as any).ast ?? slot.schema
    if (ast && ast._tag === 'Union' && ast.types) {
      return ast.types.map((t: any) => ({
        token: String(t.value ?? t.literal ?? t),
        kind: 'value' as const,
        executable: false,
        description: slot.description,
      }))
    }
    if (ast && ast._tag === 'Literal') {
      return [
        {
          token: String(ast.literal),
          kind: 'value' as const,
          executable: false,
          description: slot.description,
        },
      ]
    }
  } catch {
    // fallback
  }
  return []
}

/** Filter slot choices by query (simple substring match). */
const filterSlotChoices = (choices: Choice[], query: string): Choice[] => {
  if (query === '') return choices
  const lower = query.toLowerCase()
  return choices.filter((c) => c.token.toLowerCase().includes(lower))
}

/** Build SlotState array from resolver state. */
const buildSlotStates = (state: SlotResolverState): SlotState[] =>
  state.slots.map((slot) => {
    const filled = state.values.get(slot.name)
    return {
      name: slot.name,
      kind: slot._tag,
      value: filled?.value ?? null,
      required: slot.required !== false,
      preTakeQuery: filled?.preTakeQuery,
    }
  })

/** Check if all required slots are filled. */
const allRequiredFilled = (state: SlotResolverState): boolean =>
  state.slots.every((slot) => {
    if (slot.required === false) return true
    return state.values.has(slot.name)
  })

/** Create a Slot Resolver for a capability's slots. */
export const SlotResolver = {
  create: (slots: ReadonlyArray<AnySlot>) => {
    const state: SlotResolverState = {
      slots: [...slots],
      focusedIndex: 0,
      values: new Map(),
      query: '',
      cachedCandidates: new Map(),
      loading: false,
    }

    const getFocusedSlot = (): AnySlot | null => state.slots[state.focusedIndex] ?? null

    const getChoices = (): Choice[] => buildSlotChoices(state)

    const getSlotStates = (): SlotState[] => buildSlotStates(state)

    const getFocusedSlotName = (): string | null => getFocusedSlot()?.name ?? null

    const isComplete = (): boolean => allRequiredFilled(state)

    const isLoading = (): boolean => state.loading

    const getQuery = (): string => state.query

    /** Push a character to the slot query. */
    const queryPush = (char: string): void => {
      const slot = getFocusedSlot()
      if (!slot) return

      // For Text slots, any character is valid (including space)
      if (slot._tag === 'Text') {
        state.query += char
        return
      }

      // For other slots, space means take top choice
      if (char === ' ') {
        const choices = getChoices()
        if (choices.length > 0 && state.query.length > 0) {
          takeChoice(choices[0]!)
        }
        return
      }

      // Dead-end prevention for non-text slots
      const newQuery = state.query + char
      const choices = filterSlotChoices(buildSlotChoices({ ...state, query: '' } as any), newQuery)
      if (choices.length === 0) return // reject

      state.query = newQuery

      // Auto-advance on 1 match
      if (choices.length === 1) {
        takeChoice(choices[0]!)
      }
    }

    /** Undo the last character, or un-fill the previous slot. */
    const queryUndo = (): void => {
      if (state.query.length > 0) {
        state.query = state.query.slice(0, -1)
      } else if (state.focusedIndex > 0) {
        // Go back to previous slot
        state.focusedIndex--
        const prevSlot = state.slots[state.focusedIndex]!
        const filled = state.values.get(prevSlot.name)
        if (filled) {
          state.query = filled.preTakeQuery
          state.values.delete(prevSlot.name)
        }
      }
      // If at first slot with empty query, caller handles (return to command resolution)
    }

    /** Take a specific choice as the slot value. */
    const takeChoice = (choice: Choice): void => {
      const slot = getFocusedSlot()
      if (!slot) return

      const value = (choice as any)._value ?? choice.token
      state.values.set(slot.name, { value, preTakeQuery: state.query })
      state.query = ''

      // Move to next unfilled slot
      advanceToNextSlot()
    }

    /** Take the top choice. */
    const takeTop = (): void => {
      const choices = getChoices()
      if (choices.length > 0) {
        takeChoice(choices[0]!)
      }
    }

    /** Submit the current query as a text slot value. */
    const submitText = (): boolean => {
      const slot = getFocusedSlot()
      if (!slot || slot._tag !== 'Text') return false
      if (state.query.length === 0 && slot.required !== false) return false

      state.values.set(slot.name, { value: state.query, preTakeQuery: state.query })
      state.query = ''
      advanceToNextSlot()
      return true
    }

    /** Skip the current optional slot. */
    const skipOptional = (): boolean => {
      const slot = getFocusedSlot()
      if (!slot || slot.required !== false) return false

      state.query = ''
      advanceToNextSlot()
      return true
    }

    /** Undo the last taken choice (go back to previous slot). */
    const choiceUndo = (): boolean => {
      state.query = ''
      if (state.focusedIndex > 0) {
        const currentSlot = state.slots[state.focusedIndex]!
        state.values.delete(currentSlot.name)
        state.focusedIndex--
        const prevSlot = state.slots[state.focusedIndex]!
        state.values.delete(prevSlot.name)
        return true
      }
      // At first slot — caller should return to command resolution
      return false
    }

    /** Advance to the next unfilled slot, or stay if all filled. */
    const advanceToNextSlot = (): void => {
      for (let i = state.focusedIndex + 1; i < state.slots.length; i++) {
        if (!state.values.has(state.slots[i]!.name)) {
          state.focusedIndex = i
          return
        }
      }
      // All remaining slots are filled — move past the end
      state.focusedIndex = state.slots.length
    }

    /** Check if the focused slot is at or past the end (all slots resolved). */
    const isPastEnd = (): boolean => state.focusedIndex >= state.slots.length

    /** Reset all slot state. */
    const reset = (): void => {
      state.focusedIndex = 0
      state.values.clear()
      state.query = ''
      state.loading = false
    }

    return {
      getFocusedSlot,
      getFocusedSlotName,
      getChoices,
      getSlotStates,
      getQuery,
      isComplete,
      isLoading,
      isPastEnd,
      queryPush,
      queryUndo,
      takeChoice,
      takeTop,
      submitText,
      skipOptional,
      choiceUndo,
      reset,
    }
  },
} as const
