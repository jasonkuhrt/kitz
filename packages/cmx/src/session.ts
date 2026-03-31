import { Effect, Exit, Layer } from 'effect'
import type { AnyCommand, CommandLeaf, CommandHybrid } from './command.js'
import type { Resolution, SlotState } from './resolution.js'
import type { Choice } from './choice.js'
import type { AnyCapability, CapabilityComposite } from './capability.js'
import type { AnySlot, SlotSearch } from './slot.js'
import { CommandResolver } from './command-resolver.js'
import { SlotResolver } from './slot-resolver.js'
import type { MatcherService } from './matcher.js'
import { buildExecutableEffect } from './slot-values.js'

/** Consumer-provided Layer whose service type is erased at storage boundaries. */
type AnyLayer = Layer.Layer<any>

/** The phase of the session lifecycle. */
type SessionPhase = 'command' | 'slot'

/** Internal session state. */
interface SessionState {
  phase: SessionPhase
  commandResolver: ReturnType<typeof CommandResolver.create>
  slotResolver: ReturnType<typeof SlotResolver.create> | null
  /** The resolved command (leaf or hybrid) when in slot phase. */
  resolvedCommand: (CommandLeaf | CommandHybrid) | null
  /** Dynamic layers from HandleKeyContext. */
  dynamicLayers: Record<string, AnyLayer>
  /** Static layers collected from the AppMap scope chain. */
  scopeLayers: ReadonlyArray<AnyLayer>
}

/**
 * Build a composite execution Effect where each step sees only its declared slots.
 * This enforces the documented contract: "Each capability sees only the slots it declared."
 */
const buildScopedCompositeEffect = (
  composite: CapabilityComposite,
  allValues: Readonly<Record<string, unknown>>,
  layers?: Layer.Layer<any>,
): Effect.Effect<void> => {
  const stepEffects = composite.steps.map((step) => {
    // Scope slot values to only this step's declared slots
    const declaredSlotNames = new Set(step.capability.slots.map((s) => s.name))
    const scopedValues: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(allValues)) {
      if (declaredSlotNames.has(k)) scopedValues[k] = v
    }

    const stepEffect =
      step.capability._tag === 'Capability'
        ? step.capability.execute
        : buildScopedCompositeEffect(step.capability as CapabilityComposite, scopedValues, layers)

    return buildExecutableEffect(stepEffect, scopedValues, layers)
  })
  return Effect.all(stepEffects, { discard: true })
}

/**
 * Build a combined Resolution from command resolver state + optional slot resolver state.
 */
const buildCombinedResolution = (state: SessionState): Resolution => {
  const commandResolution = state.commandResolver.getResolution()

  if (state.phase === 'slot' && state.slotResolver) {
    // In slot phase: use slot resolver's choices and query, but keep command's accepted tokens
    const slotChoices = state.slotResolver.getChoices()
    const slotStates = state.slotResolver.getSlotStates()
    const focusedSlot = state.slotResolver.getFocusedSlotName()
    const allFilled = state.slotResolver.isComplete()

    // Build effect when all slots are filled
    let effect: Effect.Effect<void> | null = null
    let executable = false

    if (allFilled && state.resolvedCommand) {
      const capability = state.resolvedCommand.capability
      const slotValues = getSlotValuesFromState(state)
      const combinedLayers = buildCombinedLayers(state)
      if (capability._tag === 'Capability') {
        effect = buildExecutableEffect(capability.execute, slotValues, combinedLayers)
        executable = true
      } else if (capability._tag === 'Composite') {
        effect = buildScopedCompositeEffect(capability, slotValues, combinedLayers)
        executable = true
      }
    }

    return {
      mode: commandResolution.mode,
      acceptedTokens: commandResolution.acceptedTokens,
      query: state.slotResolver.getQuery(),
      _tag: commandResolution._tag,
      executable,
      effect,
      complete: allFilled,
      topChoice: slotChoices.length > 0 ? slotChoices[0]! : null,
      choices: slotChoices,
      choicesLoading: state.slotResolver.isLoading(),
      slots: slotStates,
      focusedSlot,
    }
  }

  // Wrap executable effects with layers (the CommandResolver returns raw cap.execute)
  if (commandResolution.executable && commandResolution.effect) {
    const combinedLayers = buildCombinedLayers(state)
    return {
      ...commandResolution,
      effect: combinedLayers
        ? buildExecutableEffect(commandResolution.effect, {}, combinedLayers)
        : commandResolution.effect,
    }
  }

  return commandResolution
}

/**
 * Find the resolved command from accepted tokens.
 */
const findResolvedCommand = (
  commands: ReadonlyArray<AnyCommand>,
  resolution: Resolution,
): (CommandLeaf | CommandHybrid) | null => {
  if (resolution._tag !== 'Leaf' && resolution._tag !== 'Hybrid') return null

  // Walk the command tree using accepted tokens
  const tokens =
    resolution.mode === 'flat'
      ? resolution.acceptedTokens.length > 0
        ? resolution.acceptedTokens[resolution.acceptedTokens.length - 1]!.token.split(' ')
        : []
      : resolution.acceptedTokens.map((t) => t.token)

  let current: ReadonlyArray<AnyCommand> = commands
  let found: AnyCommand | null = null

  for (const token of tokens) {
    found = current.find((c) => c.name === token) ?? null
    if (!found) return null
    if ('children' in found) {
      current = found.children
    }
  }

  if (found && (found._tag === 'Leaf' || found._tag === 'Hybrid')) {
    return found
  }
  return null
}

/** Extract slot values from the session state. */
const getSlotValuesFromState = (state: SessionState): Readonly<Record<string, unknown>> => {
  if (!state.slotResolver) return {}
  const slotStates = state.slotResolver.getSlotStates()
  const values: Record<string, unknown> = {}
  for (const ss of slotStates) {
    if (ss.value !== null) {
      values[ss.name] = ss.value
    }
  }
  return values
}

/** Build a combined Layer from scope layers + dynamic layers. */
const buildCombinedLayers = (state: SessionState): AnyLayer | undefined => {
  const layers: AnyLayer[] = [...state.scopeLayers]
  for (const layer of Object.values(state.dynamicLayers)) {
    layers.push(layer)
  }
  if (layers.length === 0) return undefined
  return layers.reduce((acc, layer) => Layer.merge(acc, layer))
}

/**
 * Confirm the focused slot — handles all slot kinds in one place.
 * This eliminates scattered slot-kind branching in Session methods.
 *
 * - Optional + empty query → skip (not submit "")
 * - Text → validate through schema and submit
 * - Non-text → take top choice
 */
const confirmFocusedSlot = (resolver: ReturnType<typeof SlotResolver.create>): void => {
  const slot = resolver.getFocusedSlot()
  if (!slot) return

  // Optional slot with empty query → skip
  if (slot.required === false && resolver.getQuery() === '') {
    resolver.skipOptional()
    return
  }

  // Text → validate and submit
  if (slot._tag === 'Text') {
    resolver.submitText()
    return
  }

  // Non-text → take top choice
  resolver.takeTop()
}

/**
 * Eagerly load candidates for Fuzzy slots by running their source Effect
 * synchronously. If the source requires async, this is a no-op
 * and the caller must load candidates externally via setCandidates.
 *
 * When a combined layer is provided, it is applied to each source Effect
 * before running — this allows sources that depend on services (provided
 * via scopeLayers/dynamicLayers) to resolve synchronously.
 */
const eagerLoadFuzzyCandidates = (
  slots: ReadonlyArray<AnySlot>,
  resolver: ReturnType<typeof SlotResolver.create>,
  combinedLayer?: AnyLayer,
): void => {
  for (const slot of slots) {
    if (slot._tag !== 'Fuzzy') continue
    const source = slot.source as Effect.Effect<
      ReadonlyArray<{ value: unknown; label: string; description?: string }>
    >
    const provided = combinedLayer ? Effect.provide(source, combinedLayer) : source
    const exit = Effect.runSyncExit(provided)
    if (Exit.isSuccess(exit)) {
      resolver.setCandidates(slot.name, exit.value as any)
    }
    // If the Effect requires async, runSyncExit returns a failure.
    // The slot stays in loading state — callers can use setCandidates later.
  }
}

/**
 * Trigger the source function for a Search slot when the focused slot
 * is Search and the query has changed. Runs the source Effect synchronously
 * and injects the results via setCandidates.
 */
const triggerSearchSource = (state: SessionState): void => {
  if (!state.slotResolver) return
  const slot = state.slotResolver.getFocusedSlot()
  if (!slot || slot._tag !== 'Search') return

  const query = state.slotResolver.getQuery()
  const source = (slot as SlotSearch).source
  const sourceEffect = source(query)
  const combinedLayer = buildCombinedLayers(state)
  const provided = combinedLayer ? Effect.provide(sourceEffect, combinedLayer) : sourceEffect
  const exit = Effect.runSyncExit(provided)
  if (Exit.isSuccess(exit)) {
    state.slotResolver.setCandidates(slot.name, exit.value as any)
  }
}

/**
 * Create a Session — the state machine that coordinates command resolution,
 * slot resolution, and effect building.
 *
 * The Session has two phases:
 * - **command**: routing through the CommandResolver (flat/tree mode navigation)
 * - **slot**: routing through the SlotResolver (filling typed parameters)
 *
 * Transition from command → slot happens when a leaf/hybrid command with slots
 * is resolved. Transition back from slot → command happens when the user undoes
 * past the first slot.
 */
export const Session = {
  create: (
    commands: ReadonlyArray<AnyCommand>,
    proximities: ReadonlyMap<string, number>,
    options?: {
      readonly dynamicLayers?: Record<string, AnyLayer>
      readonly scopeLayers?: ReadonlyArray<AnyLayer>
      readonly matcher?: MatcherService
    },
  ) => {
    const matcher = options?.matcher
    const state: SessionState = {
      phase: 'command',
      commandResolver: CommandResolver.create(commands, proximities, matcher),
      slotResolver: null,
      resolvedCommand: null,
      dynamicLayers: options?.dynamicLayers ?? {},
      scopeLayers: options?.scopeLayers ?? [],
    }

    /** Get the current combined resolution. */
    const getResolution = (): Resolution => buildCombinedResolution(state)

    /** Check if a command-phase resolution should transition to slot phase. */
    const maybeTransitionToSlots = (resolution: Resolution): Resolution => {
      if (state.phase !== 'command') return resolution

      // If the command resolver says "resolved but not executable" and the command has slots
      if (resolution._tag === 'Leaf' || resolution._tag === 'Hybrid') {
        const cmd = findResolvedCommand(commands, resolution)
        if (cmd && cmd.capability.slots.length > 0) {
          state.phase = 'slot'
          state.resolvedCommand = cmd
          state.slotResolver = SlotResolver.create(cmd.capability.slots, matcher)
          eagerLoadFuzzyCandidates(cmd.capability.slots, state.slotResolver, buildCombinedLayers(state))
          return buildCombinedResolution(state)
        }
      }
      // INVARIANT: always return through buildCombinedResolution so layers are applied
      return buildCombinedResolution(state)
    }

    /** Push a character to the current resolver. */
    const queryPush = (char: string): Resolution => {
      if (state.phase === 'slot' && state.slotResolver) {
        state.slotResolver.queryPush(char)
        // Trigger Search slot source when the focused slot is Search
        triggerSearchSource(state)
        return buildCombinedResolution(state)
      }

      const resolution = state.commandResolver.queryPush(char)
      return maybeTransitionToSlots(resolution)
    }

    /** Undo the last character (or cross phase boundary). */
    const queryUndo = (): Resolution => {
      if (state.phase === 'slot' && state.slotResolver) {
        const query = state.slotResolver.getQuery()
        const focusedSlot = state.slotResolver.getFocusedSlot()

        // If at first slot with empty query, try to undo into previous slot
        // or transition back to command phase
        if (query === '') {
          const undoOk = state.slotResolver.choiceUndo()
          if (!undoOk) {
            // At first slot boundary — return to command resolution
            state.phase = 'command'
            state.slotResolver = null
            state.resolvedCommand = null
            return state.commandResolver.queryUndo()
          }
          return buildCombinedResolution(state)
        }

        state.slotResolver.queryUndo()
        return buildCombinedResolution(state)
      }

      return state.commandResolver.queryUndo()
    }

    /** Take the top choice in the current resolver. */
    const choiceTakeTop = (): Resolution => {
      if (state.phase === 'slot' && state.slotResolver) {
        confirmFocusedSlot(state.slotResolver)
        return buildCombinedResolution(state)
      }

      const resolution = state.commandResolver.choiceTakeTop()
      return maybeTransitionToSlots(resolution)
    }

    /** Take a specific choice. */
    const choiceTake = (choice: Choice): Resolution => {
      if (state.phase === 'slot' && state.slotResolver) {
        state.slotResolver.takeChoice(choice)
        return buildCombinedResolution(state)
      }

      const resolution = state.commandResolver.choiceTake(choice)
      return maybeTransitionToSlots(resolution)
    }

    /** Toggle between flat and tree mode (only in command phase). */
    const toggleMode = (): Resolution => {
      if (state.phase === 'command') {
        state.commandResolver.toggleMode()
      }
      return buildCombinedResolution(state)
    }

    /** Confirm the current state (Enter key). */
    const confirm = (): Resolution => {
      if (state.phase === 'slot' && state.slotResolver) {
        confirmFocusedSlot(state.slotResolver)
        return buildCombinedResolution(state)
      }

      const current = buildCombinedResolution(state)
      if (current.executable) {
        return current
      }
      const resolution = state.commandResolver.choiceTakeTop()
      return maybeTransitionToSlots(resolution)
    }

    /** Get the filled slot values (for effect building). */
    const getSlotValues = (): Readonly<Record<string, unknown>> => {
      if (!state.slotResolver) return {}
      const slotStates = state.slotResolver.getSlotStates()
      const values: Record<string, unknown> = {}
      for (const ss of slotStates) {
        if (ss.value !== null) {
          values[ss.name] = ss.value
        }
      }
      return values
    }

    /** Get the current phase. */
    const getPhase = (): SessionPhase => state.phase

    /** Get the resolved command (available in slot phase). */
    const getResolvedCommand = (): (CommandLeaf | CommandHybrid) | null => state.resolvedCommand

    /** Get the dynamic layers for effect building. */
    const getDynamicLayers = (): Record<string, AnyLayer> => state.dynamicLayers

    /** Update dynamic layers (called when HandleKeyContext changes). */
    const setDynamicLayers = (layers: Record<string, AnyLayer>): void => {
      state.dynamicLayers = layers
    }

    return {
      getResolution,
      getPhase,
      getResolvedCommand,
      getSlotValues,
      getDynamicLayers,
      setDynamicLayers,
      queryPush,
      queryUndo,
      choiceTakeTop,
      choiceTake,
      toggleMode,
      confirm,
    }
  },
} as const
