import { Effect, Exit, pipe, Stream } from 'effect'
import * as Readline from 'readline'

export type Key =
  | 'up'
  | 'left'
  | 'down'
  | 'right'
  | 'tab'
  | 'return'
  | 'escape'
  | 'backspace'
  | 'a'
  | 'b'
  | 'c'
  | 'd'
  | 'e'
  | 'f'
  | 'g'
  | 'h'
  | 'i'
  | 'j'
  | 'k'
  | 'l'
  | 'm'
  | 'n'
  | 'o'
  | 'p'
  | 'q'
  | 'r'
  | 's'
  | 't'
  | 'u'
  | 'v'
  | 'w'
  | 'x'
  | 'y'
  | 'z'

export interface KeyPressEvent<Name extends Key = Key> {
  name: Name
  ctrl: boolean
  meta: boolean
  shift: boolean
  sequence: string
}

export interface KeyPressDependencies {
  stdin: Pick<
    typeof process.stdin,
    'isRaw' | 'setRawMode' | 'on' | 'removeListener'
  >
  stdout: typeof process.stdout
  createInterface: typeof Readline.promises.createInterface
  emitKeypressEvents: typeof Readline.emitKeypressEvents
}

export const createKeyPressDependencies = (): KeyPressDependencies => ({
  stdin: process.stdin,
  stdout: process.stdout,
  createInterface: Readline.promises.createInterface,
  emitKeypressEvents: Readline.emitKeypressEvents,
})

export const readOneWith = (dependencies: KeyPressDependencies): Effect.Effect<KeyPressEvent> =>
  Effect.callback<KeyPressEvent>((resume) => {
    const rl = dependencies.createInterface({
      input: dependencies.stdin as typeof process.stdin,
      output: dependencies.stdout,
      terminal: false,
    })
    const originalIsRawState = dependencies.stdin.isRaw
    if (!dependencies.stdin.isRaw) {
      dependencies.stdin.setRawMode(true)
    }
    dependencies.emitKeypressEvents(dependencies.stdin as typeof process.stdin, rl)
    const listener = (_key: string, event: KeyPressEvent) => {
      rl.close()
      dependencies.stdin.removeListener(`keypress`, listener)
      if (!originalIsRawState) {
        dependencies.stdin.setRawMode(false)
      }
      resume(Effect.succeed(event))
    }

    dependencies.stdin.on(`keypress`, listener)
  })

export const readOne = readOneWith(createKeyPressDependencies())

export const readManyFrom = (
  readOneEffect: Effect.Effect<KeyPressEvent>,
  params?: { exitOnCtrlC?: boolean },
) =>
  pipe(
    Stream.fromEffectRepeat(readOneEffect),
    Stream.map((event: KeyPressEvent) =>
      event.name == `c` && event.ctrl && params?.exitOnCtrlC !== false ? Exit.void : event,
    ),
    Stream.takeUntil((event) => {
      return Exit.isExit(event)
    }),
  )

export const readMany = (
  params?: { exitOnCtrlC?: boolean },
  readOneEffect: Effect.Effect<KeyPressEvent> = readOne,
) => readManyFrom(readOneEffect, params)
