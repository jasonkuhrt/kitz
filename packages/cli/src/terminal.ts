import { Str } from '@kitz/core'

export interface TerminalFormatOptions {
  readonly color?: boolean
  readonly env?: Record<string, string | undefined>
  readonly stdoutIsTTY?: boolean
}

export type TerminalTone = 'accent' | 'deferred' | 'error' | 'info' | 'manual' | 'success' | 'warn'

type Styler = (value: string) => string

export interface TerminalTheme {
  readonly color: boolean
  readonly accent: Styler
  readonly dim: Styler
  readonly error: Styler
  readonly heading: Styler
  readonly info: Styler
  readonly success: Styler
  readonly warn: Styler
  readonly badge: (tone: TerminalTone, label: string) => string
  readonly code: (value: string) => string
  readonly key: (label: string) => string
  readonly section: (title: string) => string
  readonly url: (value: string) => string
}

const identity: Styler = (value) => value
const RESET = '\u001b[0m'
const BOLD = '\u001b[1m'
const DIM = '\u001b[2m'
const UNDERLINE = '\u001b[4m'
const FG_BLACK = '\u001b[30m'
const FG_BLUE = '\u001b[34m'
const FG_CYAN = '\u001b[36m'
const FG_GREEN = '\u001b[32m'
const FG_RED = '\u001b[31m'
const FG_WHITE = '\u001b[37m'
const FG_YELLOW = '\u001b[33m'
const FG_GRAY = '\u001b[90m'
const BG_BLUE = '\u001b[44m'
const BG_BLUE_BRIGHT = '\u001b[104m'
const BG_CYAN = '\u001b[46m'
const BG_GREEN = '\u001b[42m'
const BG_MAGENTA = '\u001b[45m'
const BG_RED = '\u001b[41m'
const BG_YELLOW = '\u001b[43m'

const style =
  (...codes: readonly string[]): Styler =>
  (value) =>
    codes.join('') + value + RESET

export const resolveUseColor = (options?: TerminalFormatOptions): boolean => {
  if (options?.color !== undefined) return options.color

  const env = options?.env ?? {}
  if (env['NO_COLOR'] !== undefined) return false

  const forceColor = env['FORCE_COLOR']
  if (forceColor !== undefined) {
    return forceColor !== '0'
  }

  return options?.stdoutIsTTY ?? process.stdout?.isTTY ?? false
}

export const createTerminalTheme = (options?: TerminalFormatOptions): TerminalTheme => {
  const color = resolveUseColor(options)

  if (!color) {
    return {
      color,
      accent: identity,
      dim: identity,
      error: identity,
      heading: identity,
      info: identity,
      success: identity,
      warn: identity,
      badge: (_, label) => `[${label}]`,
      code: (value) => `\`${value}\``,
      key: (label) => `${label}:`,
      section: (title) => `${title}\n${'─'.repeat(Str.Visual.width(title))}`,
      url: identity,
    }
  }
  const badge = (tone: TerminalTone, label: string): string => {
    const value = ` ${label} `

    switch (tone) {
      case 'accent':
        return style(BG_BLUE_BRIGHT, FG_BLACK)(value)
      case 'deferred':
        return style(BG_CYAN, FG_BLACK)(value)
      case 'error':
        return style(BG_RED, FG_WHITE)(value)
      case 'info':
        return style(BG_BLUE, FG_WHITE)(value)
      case 'manual':
        return style(BG_MAGENTA, FG_WHITE)(value)
      case 'success':
        return style(BG_GREEN, FG_BLACK)(value)
      case 'warn':
        return style(BG_YELLOW, FG_BLACK)(value)
    }
  }

  return {
    color,
    accent: style(BOLD, FG_CYAN),
    dim: style(DIM, FG_GRAY),
    error: style(FG_RED),
    heading: style(BOLD, FG_WHITE),
    info: style(FG_BLUE),
    success: style(FG_GREEN),
    warn: style(FG_YELLOW),
    badge,
    code: (value) => style(BOLD, FG_CYAN)(`\`${value}\``),
    key: (label) => style(DIM, FG_GRAY)(`${label}:`),
    section: (title) =>
      `${style(BOLD, FG_WHITE)(title)}\n${style(DIM, FG_GRAY)('─'.repeat(Str.Visual.width(title)))}`,
    url: style(UNDERLINE, FG_BLUE),
  }
}
