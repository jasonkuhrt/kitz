import { Effect, Exit, Stream } from 'effect'
import * as Readline from 'readline/promises'
import { KeyPress } from '../../KeyPress/_.js'
import type { PromptEngine } from '../../PromptEngine/PromptEngine.js'
import { create } from './_core.js'

export type ProcessPrompter = ReturnType<typeof createProcessPrompter>

export interface ProcessPrompterDependencies {
  output?: (value: string) => unknown
  readMany?: typeof KeyPress.readMany
  readKeyPresses?: <K extends KeyPress.Key>(
    params?: PromptEngine.ReadKeyPressesParams<K>,
  ) => Stream.Stream<Exit.Exit<void> | KeyPress.KeyPressEvent<K>>
  readLine?: () => Effect.Effect<string>
  createInterface?: typeof Readline.createInterface
  stdin?: typeof process.stdin
  stdout?: typeof process.stdout
}

export const createProcessChannels = (dependencies: ProcessPrompterDependencies = {}) => ({
  output: (value: string) =>
    (
      dependencies.output ??
      ((value: string) => (dependencies.stdout ?? process.stdout).write(value))
    )(value),
  readKeyPresses: <K extends KeyPress.Key>(params?: PromptEngine.ReadKeyPressesParams<K>) =>
    dependencies.readKeyPresses
      ? dependencies.readKeyPresses(params)
      : (dependencies.readMany ?? KeyPress.readMany)().pipe(
          Stream.filter((event): event is Exit.Exit<void> | KeyPress.KeyPressEvent<K> => {
            if (Exit.isExit(event)) return true
            return params?.matching ? params.matching.some((name) => name === event.name) : true
          }),
        ),
  readLine: () =>
    dependencies.readLine
      ? dependencies.readLine()
      : Effect.callback<string>((resume) => {
          const lineReader = (dependencies.createInterface ?? Readline.createInterface)({
            input: dependencies.stdin ?? process.stdin,
          })
          lineReader.once(`line`, (value: string) => {
            lineReader.close()
            resume(Effect.succeed(value))
          })
        }),
})

export const createProcessPrompter = (dependencies: ProcessPrompterDependencies = {}) => {
  return create(createProcessChannels(dependencies))
}
