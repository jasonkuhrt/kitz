import { Str } from '@kitz/core'
import { describe, expect, test } from 'bun:test'
import { createTerminalTheme, resolveUseColor } from './terminal.js'

describe('release terminal theme', () => {
  test('prefers explicit color settings over environment and tty defaults', () => {
    expect(
      resolveUseColor({
        color: true,
        env: { NO_COLOR: '1', FORCE_COLOR: '0' },
        stdoutIsTTY: false,
      }),
    ).toBe(true)
    expect(
      resolveUseColor({
        color: false,
        env: { FORCE_COLOR: '1' },
        stdoutIsTTY: true,
      }),
    ).toBe(false)
  })

  test('supports NO_COLOR, FORCE_COLOR, and tty fallback resolution', () => {
    expect(resolveUseColor({ env: { NO_COLOR: '1' }, stdoutIsTTY: true })).toBe(false)
    expect(resolveUseColor({ env: { FORCE_COLOR: '1' }, stdoutIsTTY: false })).toBe(true)
    expect(resolveUseColor({ stdoutIsTTY: true })).toBe(true)
    expect(resolveUseColor({ stdoutIsTTY: false })).toBe(false)
  })

  test('renders plain text without ansi when colors are disabled', () => {
    const theme = createTerminalTheme({ color: false })

    expect(theme.badge('warn', 'WARN')).toBe('[WARN]')
    expect(theme.code('release apply')).toBe('`release apply`')
    expect(theme.section('Doctor')).toBe('Doctor\n──────')
  })

  test('renders ansi-styled output when colors are enabled', () => {
    const theme = createTerminalTheme({ color: true })
    const badge = theme.badge('success', 'PASS')
    const manual = theme.badge('manual', 'MANUAL')
    const code = theme.code('release doctor')
    const section = theme.section('Apply')

    expect(badge).toContain('\u001b[')
    expect(manual).toContain('\u001b[')
    expect(code).toContain('\u001b[')
    expect(section).toContain('\u001b[')
    expect(Str.Visual.strip(badge)).toBe(' PASS ')
    expect(Str.Visual.strip(manual)).toBe(' MANUAL ')
    expect(Str.Visual.strip(code)).toBe('`release doctor`')
    expect(Str.Visual.strip(section)).toBe('Apply\n─────')
  })
})
