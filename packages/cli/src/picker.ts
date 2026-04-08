import { Str } from '@kitz/core'
import { Effect, PlatformError, Queue, Terminal } from 'effect'
import { createTerminalTheme, resolveUseColor, type TerminalFormatOptions } from './terminal.js'

const ANSI_ALT_SCREEN_ENTER = '\u001b[?1049h'
const ANSI_ALT_SCREEN_EXIT = '\u001b[?1049l'
const ANSI_CLEAR_SCREEN = '\u001b[2J'
const ANSI_CURSOR_HOME = '\u001b[H'
const ANSI_CURSOR_HIDE = '\u001b[?25l'
const ANSI_CURSOR_SHOW = '\u001b[?25h'

export interface InteractiveTerminalOptions extends TerminalFormatOptions {
  readonly stdinIsTTY?: boolean
}

export type InteractiveTerminalUnavailabilityReason =
  | 'ci'
  | 'stdin-not-tty'
  | 'stdout-not-tty'
  | 'stdin-and-stdout-not-tty'

export type InteractiveTerminalCapabilities = {
  readonly color: boolean
  readonly env: Record<string, string | undefined>
  readonly interactive: boolean
  readonly stdinIsTTY: boolean
  readonly stdoutIsTTY: boolean
} & (
  | { readonly interactive: true }
  | {
      readonly interactive: false
      readonly reason: InteractiveTerminalUnavailabilityReason
    }
)

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

export interface PickerKeyEvent {
  readonly name: string
  readonly ctrl: boolean
  readonly meta: boolean
  readonly shift: boolean
}

export interface PickerRuntime {
  readonly display: (value: string) => Effect.Effect<void, PlatformError.PlatformError>
  readonly readKey: Effect.Effect<PickerKeyEvent>
}

export type PickerResult<T> =
  | { readonly _tag: 'selected'; readonly value: T }
  | { readonly _tag: 'cancelled' }
  | { readonly _tag: 'empty' }

export type InteractiveCommandSelectionFailureReason =
  | InteractiveTerminalUnavailabilityReason
  | 'cancelled'
  | 'empty'

export type InteractiveCommandSelection<T> =
  | { readonly _tag: 'resolved'; readonly value: T }
  | {
      readonly _tag: 'missing'
      readonly reason: InteractiveCommandSelectionFailureReason
    }

const isTruthyEnvFlag = (value: string | undefined): boolean =>
  value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false'

export const describeInteractiveTerminalRequirement = (
  reason: InteractiveTerminalUnavailabilityReason,
): string => {
  switch (reason) {
    case 'ci':
      return 'Interactive selection is disabled when the CI environment flag is set.'
    case 'stdin-not-tty':
      return 'Interactive selection requires stdin to be a TTY.'
    case 'stdout-not-tty':
      return 'Interactive selection requires stdout to be a TTY.'
    case 'stdin-and-stdout-not-tty':
      return 'Interactive selection requires both stdin and stdout to be TTYs.'
  }
}

export const resolveInteractiveCommandSelection = <T, E, R>(params: {
  readonly provided: T | undefined
  readonly terminal: InteractiveTerminalCapabilities
  readonly pick: () => Effect.Effect<PickerResult<T>, E, R>
}): Effect.Effect<InteractiveCommandSelection<T>, E, R> => {
  if (params.provided !== undefined) {
    return Effect.succeed({
      _tag: 'resolved',
      value: params.provided,
    })
  }

  if (!params.terminal.interactive) {
    return Effect.succeed({
      _tag: 'missing',
      reason: params.terminal.reason,
    })
  }

  return params.pick().pipe(
    Effect.map((result): InteractiveCommandSelection<T> => {
      switch (result._tag) {
        case 'selected':
          return {
            _tag: 'resolved',
            value: result.value,
          }
        case 'cancelled':
          return {
            _tag: 'missing',
            reason: 'cancelled',
          }
        case 'empty':
          return {
            _tag: 'missing',
            reason: 'empty',
          }
      }
    }),
  )
}

export const resolveInteractiveTerminalCapabilities = (
  options?: InteractiveTerminalOptions,
): InteractiveTerminalCapabilities => {
  const env = options?.env ?? {}
  const stdoutIsTTY = options?.stdoutIsTTY ?? process.stdout?.isTTY ?? false
  const stdinIsTTY = options?.stdinIsTTY ?? process.stdin?.isTTY ?? false
  const color = resolveUseColor({
    ...(options?.color !== undefined ? { color: options.color } : {}),
    env,
    stdoutIsTTY,
  })

  if (isTruthyEnvFlag(env['CI'])) {
    return {
      color,
      env,
      interactive: false,
      reason: 'ci',
      stdinIsTTY,
      stdoutIsTTY,
    }
  }

  if (!stdinIsTTY && !stdoutIsTTY) {
    return {
      color,
      env,
      interactive: false,
      reason: 'stdin-and-stdout-not-tty',
      stdinIsTTY,
      stdoutIsTTY,
    }
  }

  if (!stdinIsTTY) {
    return {
      color,
      env,
      interactive: false,
      reason: 'stdin-not-tty',
      stdinIsTTY,
      stdoutIsTTY,
    }
  }

  if (!stdoutIsTTY) {
    return {
      color,
      env,
      interactive: false,
      reason: 'stdout-not-tty',
      stdinIsTTY,
      stdoutIsTTY,
    }
  }

  return {
    color,
    env,
    interactive: true,
    stdinIsTTY,
    stdoutIsTTY,
  }
}

export const isInteractiveTerminal = (options?: InteractiveTerminalOptions): boolean => {
  return resolveInteractiveTerminalCapabilities(options).interactive
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

  output(`${theme.badge('accent', 'PICK')} ${theme.heading(params.title)}`)

  if (params.hint) {
    output(theme.dim(params.hint))
  }

  output``

  if (params.options.length === 0) {
    output(theme.dim('No options are available for interactive selection.'))
  } else {
    if (window.start > 0) {
      const hidden = window.start
      output(theme.dim(`... ${String(hidden)} earlier option${hidden === 1 ? '' : 's'}`))
    }

    for (let visibleIndex = window.start; visibleIndex < window.end; visibleIndex += 1) {
      const option = params.options[visibleIndex]!
      const selected = visibleIndex === clampedIndex
      const marker = selected ? theme.accent('>') : theme.dim(' ')
      const label = selected ? theme.heading(option.label) : option.label
      output(`${marker} ${label}`)
      if (option.detail) {
        output(selected ? theme.dim('  ' + option.detail) : '  ' + option.detail)
      }
    }

    if (window.end < params.options.length) {
      const hidden = params.options.length - window.end
      output(theme.dim(`... ${String(hidden)} more option${hidden === 1 ? '' : 's'}`))
    }
  }

  output``
  output(
    theme.dim(
      `Use ${theme.code('Up/Down')} or ${theme.code('j/k')} to move, ` +
        `${theme.code('Enter')} to select, ${theme.code('Esc')} or ${theme.code('q')} to cancel.`,
    ),
  )
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

const pickCancelled = { _tag: 'cancelled' } as const satisfies PickerResult<never>
const pickEmpty = { _tag: 'empty' } as const satisfies PickerResult<never>

const isPickerCancelEvent = (event: PickerKeyEvent): boolean =>
  event.name === 'escape' ||
  event.name === 'q' ||
  (event.name === 'c' && event.ctrl) ||
  (event.name === 'd' && event.ctrl)

export const pickOptionWith = <T>(
  runtime: PickerRuntime,
  params: PickerParams<T>,
): Effect.Effect<PickerResult<T>, PlatformError.PlatformError> => {
  if (params.options.length === 0) {
    return Effect.succeed(pickEmpty)
  }

  const loop = (index: number): Effect.Effect<PickerResult<T>, PlatformError.PlatformError> =>
    runtime.display(renderPickerFrame(params, index)).pipe(
      Effect.andThen(runtime.readKey),
      Effect.flatMap((event: PickerKeyEvent) => {
        if (isPickerCancelEvent(event)) {
          return Effect.succeed(pickCancelled)
        }

        if (event.name === 'return') {
          return Effect.succeed({
            _tag: 'selected',
            value: params.options[index]!.value,
          } satisfies PickerResult<T>)
        }

        if (event.name === 'up' || event.name === 'k') {
          return loop(movePickerCursor(index, -1, params.options.length))
        }

        if (event.name === 'down' || event.name === 'j') {
          return loop(movePickerCursor(index, 1, params.options.length))
        }

        return loop(index)
      }),
    )

  return loop(clamp(params.initialIndex ?? 0, 0, params.options.length - 1))
}

export const pickOption = <T>(
  params: PickerParams<T>,
): Effect.Effect<PickerResult<T>, PlatformError.PlatformError, Terminal.Terminal> => {
  if (params.options.length === 0) {
    return Effect.succeed(pickEmpty)
  }

  return Effect.scoped(
    Effect.gen(function* () {
      const terminal = yield* Terminal.Terminal
      const input = yield* terminal.readInput

      return yield* withAlternateScreen((display) =>
        pickOptionWith(
          {
            display,
            readKey: Queue.take(input).pipe(
              Effect.result,
              Effect.map((result) =>
                result._tag === 'Success'
                  ? (result.success.key satisfies PickerKeyEvent)
                  : { ctrl: false, meta: false, name: 'escape', shift: false },
              ),
            ),
          },
          params,
        ),
      )
    }),
  )
}
