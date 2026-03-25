import { Effect, Stream } from 'effect'
import type { KeyPress } from '../../KeyPress/_.js'
import type { PromptEngine } from '../../PromptEngine/PromptEngine.js'
import type { Prompter } from '../__.js'
import { create } from './_core.js'

export type MemoryPrompter = ReturnType<typeof createMemoryPrompter>

export interface MemoryPrompterState {
  inputScript: string[]
  script: {
    keyPress: KeyPress.KeyPressEvent<any>[]
  }
  history: {
    output: string[]
    answers: string[]
    all: string[]
  }
}

export const createMemoryState = (): MemoryPrompterState => ({
  inputScript: [],
  script: { keyPress: [] },
  history: {
    answers: [],
    output: [],
    all: [],
  },
})

export const createMemoryChannels = (state: MemoryPrompterState) => ({
  output: (value: string) => {
    state.history.output.push(value)
    state.history.all.push(value)
  },
  readLine: () => {
    const value = state.inputScript.shift()
    if (value === undefined) throw new Error(`No more values in read script.`)
    state.history.answers.push(value)
    state.history.all.push(value)
    return Effect.succeed(value)
  },
  readKeyPresses: <K extends KeyPress.Key>(params?: PromptEngine.ReadKeyPressesParams<K>) =>
    Stream.fromIterable(state.script.keyPress).pipe(
      Stream.filter((event): event is KeyPress.KeyPressEvent<K> => {
        return params?.matching?.includes(event.name as K) ?? true
      }),
    ),
})

/**
 * A utility for testing prompts. It allows programmatic control of
 * the input and capturing of the output of a prompts session.
 */
export const createMemoryPrompter = () => {
  const state = createMemoryState()
  const prompter: Prompter = create(createMemoryChannels(state))
  return {
    history: state.history,
    script: state.script,
    answers: {
      add: (values: string[]) => {
        state.inputScript.push(...values)
      },
      get: () => state.inputScript,
    },
    ...prompter,
  }
}
