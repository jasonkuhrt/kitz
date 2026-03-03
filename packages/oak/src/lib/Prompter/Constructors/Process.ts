import { Effect, Exit, Stream } from 'effect'
import * as Readline from 'readline/promises'
import { KeyPress } from '../../KeyPress/_.js'
import type { PromptEngine } from '../../PromptEngine/PromptEngine.js'
import { create } from './_core.js'

export type ProcessPrompter = ReturnType<typeof createProcessPrompter>

export const createProcessPrompter = () => {
  return create({
    output: (value) => process.stdout.write(value),
    readKeyPresses: <K extends KeyPress.Key>(params?: PromptEngine.ReadKeyPressesParams<K>) =>
      KeyPress.readMany().pipe(
        Stream.filter((event): event is Exit.Exit<void> | KeyPress.KeyPressEvent<K> => {
          if (Exit.isExit(event)) return true
          return params?.matching ? params.matching.some((name) => name === event.name) : true
        }),
      ),
    readLine: () =>
      Effect.async((resume) => {
        const lineReader = Readline.createInterface({
          input: process.stdin,
        })
        lineReader.once(`line`, (value) => {
          lineReader.close()
          resume(Effect.succeed(value))
        })
      }),
  })
}
