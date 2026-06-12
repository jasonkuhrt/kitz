import { Option, Schema } from 'effect'
import { Sch } from '@kitz/sch'
import type { AnySlot, SlotEnum, SlotFuzzy, SlotSearch, SlotText, SlotCandidate } from './slot.js'
import type { Choice } from './choice.js'
import type { SlotState } from './resolution.js'
import type { MatcherService } from './matcher.js'
import { Matcher } from './matcher.js'

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
const buildSlotChoices = (state: SlotResolverState, matcher: MatcherService): Choice[] => {
  const slot = state.slots[state.focusedIndex]!
  if (!slot) return []

  switch (slot._tag) {
    case 'Enum': {
      // Derive candidates from schema — for Literal schemas, extract the literals
      // This is a simplified version; full implementation would use Schema introspection
      const candidates = getEnumCandidates(slot)
      return matchSlotChoices(candidates, state.query, matcher)
    }
    case 'Fuzzy': {
      const cached = state.cachedCandidates.get(slot.name)
      if (!cached) return [] // loading
      return matchSlotChoices(
        cached.map((c) => ({
          token: c.label,
          kind: 'value' as const,
          executable: false,
          description: c.description,
          _value: c.value,
        })),
        state.query,
        matcher,
      )
    }
    case 'Search': {
      // Search candidates are injected via setCandidates after the consumer
      // runs the slot's source Effect. Same caching pattern as Fuzzy.
      const cached = state.cachedCandidates.get(slot.name) ?? []
      return matchSlotChoices(
        cached.map((c) => ({
          token: c.label,
          kind: 'value' as const,
          executable: false,
          description: c.description,
          _value: c.value,
        })),
        state.query,
        matcher,
      )
    }
    // 'Text'
    default: {
      // No candidates for text slots
      return []
    }
  }
}

/** Get enum candidates from a Literal schema via @kitz/sch AST helpers. */
const getEnumCandidates = (slot: SlotEnum): Choice[] =>
  Sch.AST.extractLiterals(slot.schema).map((literal) => ({
    token: String(literal),
    kind: 'value' as const,
    executable: false,
    description: slot.description,
  }))

/** Score and rank slot choices through the pluggable Matcher. */
const matchSlotChoices = (choices: Choice[], query: string, matcher: MatcherService): Choice[] => {
  const candidates = choices.map((c) => ({ text: c.token, _choice: c }))
  const results = matcher.match(candidates, query)
  return results.map((r) => r.candidate._choice)
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
  create: (slots: ReadonlyArray<AnySlot>, matcher: MatcherService = Matcher.substring()) => {
    const state: SlotResolverState = {
      slots: [...slots],
      focusedIndex: 0,
      values: new Map(),
      query: '',
      cachedCandidates: new Map(),
      loading: false,
    }

    const getFocusedSlot = (): AnySlot | null => state.slots[state.focusedIndex] ?? null

    /** Inject loaded candidates for a Fuzzy slot. Called after running the slot's source Effect. */
    const setCandidates = (slotName: string, candidates: SlotCandidate<unknown>[]): void => {
      state.cachedCandidates.set(slotName, candidates)
      state.loading = false
    }

    const getChoices = (): Choice[] => buildSlotChoices(state, matcher)

    const getSlotStates = (): SlotState[] => buildSlotStates(state)

    const getFocusedSlotName = (): string | null => getFocusedSlot()?.name ?? null

    const isComplete = (): boolean => allRequiredFilled(state)

    const isLoading = (): boolean => state.loading

    const getQuery = (): string => state.query

    /** Push a character to the slot query. */
    const queryPush = (char: string): void => {
      const slot = getFocusedSlot()
      if (!slot) return

      // For Text and Search slots, any character is valid.
      // Text has no candidates. Search candidates update externally per query.
      if (slot._tag === 'Text' || slot._tag === 'Search') {
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
      const choices = matchSlotChoices(
        buildSlotChoices({ ...state, query: '' } as SlotResolverState, matcher),
        newQuery,
        matcher,
      )
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

    /** Take the top choice — or skip if the slot is optional and query is empty. */
    const takeTop = (): void => {
      const slot = getFocusedSlot()
      // If the slot is optional and the user hasn't typed anything,
      // skip the slot instead of auto-filling with the first candidate.
      if (slot && slot.required === false && state.query.length === 0) {
        advanceToNextSlot()
        return
      }
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

      // Validate through the slot's schema before accepting
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- AnySlot erases the schema type parameter
      const decode = Schema.decodeUnknownOption(slot.schema as any)
      const result = decode(state.query)
      if (Option.isNone(result)) return false

      state.values.set(slot.name, { value: result.value, preTakeQuery: state.query })
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
      // If past the end (all slots filled), back up to the last slot
      if (state.focusedIndex >= state.slots.length && state.slots.length > 0) {
        state.focusedIndex = state.slots.length - 1
        const lastSlot = state.slots[state.focusedIndex]!
        const filled = state.values.get(lastSlot.name)
        state.query = filled?.preTakeQuery ?? ''
        state.values.delete(lastSlot.name)
        return true
      }
      if (state.focusedIndex > 0) {
        const currentSlot = state.slots[state.focusedIndex]
        if (currentSlot) state.values.delete(currentSlot.name)
        state.focusedIndex--
        const prevSlot = state.slots[state.focusedIndex]!
        const filled = state.values.get(prevSlot.name)
        state.query = filled?.preTakeQuery ?? ''
        state.values.delete(prevSlot.name)
        return true
      }
      // At first slot — caller should return to command resolution
      state.query = ''
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
      setCandidates,
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
