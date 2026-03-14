import { Effect } from 'effect'
import { Exit, pipe, Stream } from 'effect'
import type { KeyPress } from '../KeyPress/_.js'
import { Text } from '../Text/_.js'

/**
 * ANSI escape sequences for terminal control.
 * Inlined from ansi-escapes package.
 */
const ansi = {
  cursorShow: `\u001B[?25h`,
  cursorHide: `\u001B[?25l`,
  cursorTo: (column: number): string => `\u001B[${column + 1}G`,
  eraseLines: (count: number): string => {
    if (count === 0) return ``
    let result = ``
    for (let i = 0; i < count; i++) {
      result += `\u001B[2K` // eraseLine
      if (i < count - 1) result += `\u001B[1A` // cursorUp
    }
    result += `\u001B[G` // cursorLeft (move to beginning)
    return result
  },
}

interface KeyPressPattern {
  name?: KeyPress.Key
  shift?: boolean
}

type KeyPressPatternExpression =
  | KeyPress.Key
  | KeyPressPatternExpressionObject
  | (KeyPress.Key | KeyPressPatternExpressionObject)[]

interface KeyPressPatternExpressionObject {
  name: KeyPress.Key
  shift?: boolean
}

const isKeyPressMatchPattern = (
  event: KeyPress.KeyPressEvent,
  keyPressMatchSpec: KeyPressPattern,
) => {
  return (
    keyPressMatchSpec.name === undefined ||
    (keyPressMatchSpec.name.includes(event.name) &&
      (keyPressMatchSpec.shift === undefined || keyPressMatchSpec.shift === event.shift))
  )
}

export namespace PromptEngine {
  export interface Params<State extends object, Skippable extends boolean = false> {
    initialState: State
    channels: Channels
    /**
     * @defaultValue `false`
     */
    cursor?: boolean
    draw: (state: State) => string
    on?: {
      match?: KeyPressPatternExpression
      run: (state: State, event: KeyPress.KeyPressEvent) => State
    }[]
    skippable?: Skippable
  }

  export const create = <State extends object, Skippable extends boolean>(
    params: Params<State, Skippable>,
  ): Effect.Effect<Skippable extends true ? null | State : State> => {
    type Ret = Skippable extends true ? null | State : State
    return Effect.gen(function* () {
      const args = {
        cursor: false,
        skippable: false,
        on: [],
        ...params,
      }
      const matchers = args.on.map(({ match, run }) => {
        return {
          match: (Array.isArray(match) ? match : [match]).map((m) =>
            typeof m === `string`
              ? {
                  name: m,
                }
              : m,
          ),
          run,
        }
      })

      const { channels } = args

      const cleanup = () => {
        channels.output(Text.chars.newline)
        if (!args.cursor) channels.output(ansi.cursorShow)
        process.off(`exit`, cleanup)
      }

      let previousLineCount = 0

      const refresh = (state: State) => {
        channels.output(ansi.eraseLines(previousLineCount))
        channels.output(ansi.cursorTo(0))
        const content = args.draw(state)
        previousLineCount = content.split(Text.chars.newline).length
        channels.output(content)
      }

      if (!args.cursor) channels.output(ansi.cursorHide)
      process.once(`exit`, cleanup)

      const initialState = args.initialState
      refresh(initialState)

      return (yield* pipe(
        channels.readKeyPresses(),
        Stream.takeUntil(
          (value) => !Exit.isExit(value) && args.skippable && value.name === `escape`,
        ),
        Stream.takeUntil((value) => !Exit.isExit(value) && value.name === `return`),
        Stream.runFold(
          () => initialState as Ret,
          (state: Ret, value): Ret => {
            // todo do higher in the stack
            if (Exit.isExit(value)) {
              process.exit()
            }
            if (state === null) return null as Ret
            if (args.skippable && value.name === `escape`) return null as Ret
            if (value.name === `return`) return state
            const matcher = matchers.find((matcher) =>
              matcher.match.some((match) => isKeyPressMatchPattern(value, match ?? {})),
            )
            const newState = (matcher?.run(state as State, value) ?? state) as Ret
            refresh(newState as State)
            return newState
          },
        ),
        Effect.tap(() => {
          cleanup()
          return Effect.void
        }),
      )) as Ret
    }) as Effect.Effect<Ret>
  }

  export interface Channels {
    output: (value: string) => void
    readLine: () => Effect.Effect<string>
    readKeyPresses: <K extends KeyPress.Key>(
      params?: ReadKeyPressesParams<K>,
    ) => Stream.Stream<Exit.Exit<void> | KeyPress.KeyPressEvent<K>>
  }
  export interface ReadKeyPressesParams<K extends string> {
    matching?: K[]
  }
}
