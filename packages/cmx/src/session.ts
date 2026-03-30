import { Effect, Exit, Layer } from 'effect'
import type { AnyCommand, CommandLeaf, CommandHybrid } from './command.js'
import type { Resolution, SlotState } from './resolution.js'
import type { Choice } from './choice.js'
import type { AnyCapability } from './capability.js'
import type { AnySlot } from './slot.js'
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

/** Recursively collect execute Effects from a composite capability's steps. */
const collectStepEffects = (capability: AnyCapability): Effect.Effect<void>[] => {
  if (capability._tag === 'Capability') return [capability.execute]
  const effects: Effect.Effect<void>[] = []
  for (const step of capability.steps) {
    effects.push(...collectStepEffects(step.capability))
  }
  return effects
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
        const stepEffects = collectStepEffects(capability)
        const sequenced = Effect.all(stepEffects, { discard: true })
        effect = buildExecutableEffect(sequenced, slotValues, combinedLayers)
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
 * Eagerly load candidates for Fuzzy slots by running their source Effect
 * synchronously. If the source requires async or services, this is a no-op
 * and the caller must load candidates externally via setCandidates.
 */
const eagerLoadFuzzyCandidates = (
  slots: ReadonlyArray<AnySlot>,
  resolver: ReturnType<typeof SlotResolver.create>,
): void => {
  for (const slot of slots) {
    if (slot._tag !== 'Fuzzy') continue
    const exit = Effect.runSyncExit(slot.source as Effect.Effect<ReadonlyArray<{ value: unknown; label: string; description?: string }>>)
    if (Exit.isSuccess(exit)) {
      resolver.setCandidates(slot.name, exit.value as any)
    }
    // If the Effect requires async/services, runSyncExit returns a failure.
    // The slot stays in loading state — callers can use setCandidates later.
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
    const state: SessionState = {
      phase: 'command',
      commandResolver: CommandResolver.create(commands, proximities, options?.matcher),
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
          state.slotResolver = SlotResolver.create(cmd.capability.slots)
          eagerLoadFuzzyCandidates(cmd.capability.slots, state.slotResolver)
          return buildCombinedResolution(state)
        }
      }
      return resolution
    }

    /** Push a character to the current resolver. */
    const queryPush = (char: string): Resolution => {
      if (state.phase === 'slot' && state.slotResolver) {
        state.slotResolver.queryPush(char)
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

        // If at first slot with empty query, transition back to command phase
        if (query === '' && focusedSlot === state.slotResolver.getFocusedSlot()) {
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
        const slot = state.slotResolver.getFocusedSlot()
        if (slot && slot._tag === 'Text') {
          state.slotResolver.submitText()
        } else {
          state.slotResolver.takeTop()
        }
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
        return state.commandResolver.toggleMode()
      }
      return buildCombinedResolution(state)
    }

    /** Confirm the current state (Enter key). */
    const confirm = (): Resolution => {
      if (state.phase === 'slot' && state.slotResolver) {
        const slot = state.slotResolver.getFocusedSlot()
        if (slot && slot._tag === 'Text') {
          state.slotResolver.submitText()
        } else {
          state.slotResolver.takeTop()
        }
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
