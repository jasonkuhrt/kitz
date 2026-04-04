import { Str } from '@kitz/core'
import { Oak } from '@kitz/oak'
import { Effect, PlatformError, Terminal } from 'effect'
import { createTerminalTheme, type TerminalFormatOptions } from '../terminal.js'

const ANSI_ALT_SCREEN_ENTER = '\u001b[?1049h'
const ANSI_ALT_SCREEN_EXIT = '\u001b[?1049l'
const ANSI_CLEAR_SCREEN = '\u001b[2J'
const ANSI_CURSOR_HOME = '\u001b[H'
const ANSI_CURSOR_HIDE = '\u001b[?25l'
const ANSI_CURSOR_SHOW = '\u001b[?25h'

export interface InteractiveTerminalOptions extends TerminalFormatOptions {
  readonly stdinIsTTY?: boolean
}

export interface PickerOption<T> {
  readonly label: string
  readonly value: T
  readonly detail?: string
}

export interface PickerParams<T> extends TerminalFormatOptions {
  readonly title: string
  readonly hint?: string
  readonly options: readonly PickerOption<T>[]
  readonly initialIndex?: number
  readonly maxVisible?: number
}

export interface PickerRuntime {
  readonly display: (value: string) => Effect.Effect<void, PlatformError.PlatformError>
  readonly readKey: Effect.Effect<Oak.KeyPress.KeyPress.KeyPressEvent>
}

const isTruthyEnvFlag = (value: string | undefined): boolean =>
  value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false'

export const isInteractiveTerminal = (options?: InteractiveTerminalOptions): boolean => {
  const env = options?.env ?? {}
  if (isTruthyEnvFlag(env['CI'])) return false

  const stdoutIsTTY = options?.stdoutIsTTY ?? process.stdout?.isTTY ?? false
  const stdinIsTTY = options?.stdinIsTTY ?? process.stdin?.isTTY ?? false
  return stdoutIsTTY && stdinIsTTY
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum)

export const movePickerCursor = (index: number, direction: -1 | 1, total: number): number => {
  if (total <= 0) return 0
  return (index + direction + total) % total
}

export const getPickerWindow = (
  total: number,
  index: number,
  maxVisible: number,
): { readonly start: number; readonly end: number } => {
  if (total <= 0) {
    return { start: 0, end: 0 }
  }

  const visible = Math.max(1, Math.min(maxVisible, total))
  const centeredStart = index - Math.floor(visible / 2)
  const start = clamp(centeredStart, 0, Math.max(0, total - visible))
  return {
    start,
    end: start + visible,
  }
}

export const renderPickerFrame = <T>(params: PickerParams<T>, index: number): string => {
  const theme = createTerminalTheme(params)
  const output = Str.Builder()
  const clampedIndex = clamp(index, 0, Math.max(0, params.options.length - 1))
  const window = getPickerWindow(params.options.length, clampedIndex, params.maxVisible ?? 10)

  output`${theme.badge('accent', 'PICK')} ${theme.heading(params.title)}`

  if (params.hint) {
    output`${theme.dim(params.hint)}`
  }

  output``

  if (params.options.length === 0) {
    output`${theme.dim('No options available.')}`
  } else {
    for (let visibleIndex = window.start; visibleIndex < window.end; visibleIndex += 1) {
      const option = params.options[visibleIndex]!
      const selected = visibleIndex === clampedIndex
      const marker = selected ? theme.accent('›') : theme.dim(' ')
      const label = selected ? theme.heading(option.label) : option.label
      output`${marker} ${label}`
      if (option.detail) {
        output`${selected ? theme.dim('  ' + option.detail) : '  ' + option.detail}`
      }
    }

    if (window.start > 0 || window.end < params.options.length) {
      output``
      output(
        theme.dim(
          `Showing ${String(window.start + 1)}-${String(window.end)} of ${String(params.options.length)}`,
        ),
      )
    }
  }

  output``
  output(theme.dim('Use ↑/↓ or j/k to move, Enter to accept, Esc/q to cancel.'))
  return output.render()
}

export const withAlternateScreen = <A, E, R>(
  program: (
    display: (value: string) => Effect.Effect<void, PlatformError.PlatformError>,
  ) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E | PlatformError.PlatformError, R | Terminal.Terminal> =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const terminal = yield* Terminal.Terminal
      yield* terminal.display(
        `${ANSI_ALT_SCREEN_ENTER}${ANSI_CURSOR_HIDE}${ANSI_CLEAR_SCREEN}${ANSI_CURSOR_HOME}`,
      )
      return terminal
    }),
    (terminal) =>
      program((value) => terminal.display(`${ANSI_CURSOR_HOME}${ANSI_CLEAR_SCREEN}${value}`)),
    (terminal) =>
      terminal
        .display(
          `${ANSI_CURSOR_HOME}${ANSI_CLEAR_SCREEN}${ANSI_CURSOR_SHOW}${ANSI_ALT_SCREEN_EXIT}`,
        )
        .pipe(Effect.ignore),
  )

export const pickOptionWith = <T>(
  runtime: PickerRuntime,
  params: PickerParams<T>,
): Effect.Effect<T | undefined, PlatformError.PlatformError> =>
  Effect.gen(function* () {
    if (params.options.length === 0) return undefined

    let index = clamp(params.initialIndex ?? 0, 0, params.options.length - 1)

    while (true) {
      yield* runtime.display(renderPickerFrame(params, index))
      const event = yield* runtime.readKey

      if (event.name === 'escape' || event.name === 'q' || (event.name === 'c' && event.ctrl)) {
        return undefined
      }

      if (event.name === 'return') {
        return params.options[index]?.value
      }

      if (event.name === 'up' || event.name === 'k') {
        index = movePickerCursor(index, -1, params.options.length)
        continue
      }

      if (event.name === 'down' || event.name === 'j') {
        index = movePickerCursor(index, 1, params.options.length)
      }
    }
  })

export const pickOption = <T>(
  params: PickerParams<T>,
): Effect.Effect<T | undefined, PlatformError.PlatformError, Terminal.Terminal> =>
  withAlternateScreen((display) =>
    pickOptionWith(
      {
        display,
        readKey: Oak.KeyPress.KeyPress.readOne,
      },
      params,
    ),
  )
