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

export const readOne = Effect.async<KeyPressEvent>((resume) => {
  const rl = Readline.promises.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  })
  const originalIsRawState = process.stdin.isRaw
  if (!process.stdin.isRaw) {
    process.stdin.setRawMode(true)
  }
  Readline.emitKeypressEvents(process.stdin, rl)
  const listener = (_key: string, event: KeyPressEvent) => {
    rl.close()
    process.stdin.removeListener(`keypress`, listener)
    if (!originalIsRawState) {
      process.stdin.setRawMode(false)
    }
    resume(Effect.succeed(event))
  }

  process.stdin.on(`keypress`, listener)
})

export const readMany = (params?: { exitOnCtrlC?: boolean }) =>
  pipe(
    Stream.repeatEffect(readOne),
    Stream.map((event) => event.name == `c` && event.ctrl == true && params?.exitOnCtrlC !== false ? Exit.void : event),
    Stream.takeUntil((event) => {
      return Exit.isExit(event)
    }),
  )
