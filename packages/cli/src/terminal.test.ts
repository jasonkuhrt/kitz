import { Str } from '@kitz/core'
import { describe, expect, test } from 'vitest'
import { createTerminalTheme, resolveUseColor } from './terminal.js'

describe('cli terminal theme', () => {
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
    expect(theme.key('Next')).toBe('Next:')
    expect(theme.section('Doctor')).toBe('Doctor\n──────')
    expect(theme.url('https://example.com')).toBe('https://example.com')
  })

  test('renders ansi-styled output when colors are enabled', () => {
    const theme = createTerminalTheme({ color: true })
    const tones = {
      accent: theme.badge('accent', 'PICK'),
      deferred: theme.badge('deferred', 'SKIP'),
      error: theme.badge('error', 'FAIL'),
      info: theme.badge('info', 'INFO'),
      manual: theme.badge('manual', 'MANUAL'),
      success: theme.badge('success', 'PASS'),
      warn: theme.badge('warn', 'WARN'),
    } as const
    const code = theme.code('release doctor')
    const key = theme.key('Resume')
    const section = theme.section('Apply')

    expect(theme.accent('accent')).toContain('\u001b[')
    expect(theme.dim('dim')).toContain('\u001b[')
    expect(theme.error('error')).toContain('\u001b[')
    expect(theme.heading('heading')).toContain('\u001b[')
    expect(theme.info('info')).toContain('\u001b[')
    expect(theme.success('success')).toContain('\u001b[')
    expect(theme.warn('warn')).toContain('\u001b[')
    expect(theme.url('https://example.com')).toContain('\u001b[')
    for (const badge of Object.values(tones)) {
      expect(badge).toContain('\u001b[')
    }
    expect(code).toContain('\u001b[')
    expect(key).toContain('\u001b[')
    expect(section).toContain('\u001b[')
    expect(Str.Visual.strip(tones.accent)).toBe(' PICK ')
    expect(Str.Visual.strip(tones.deferred)).toBe(' SKIP ')
    expect(Str.Visual.strip(tones.error)).toBe(' FAIL ')
    expect(Str.Visual.strip(tones.info)).toBe(' INFO ')
    expect(Str.Visual.strip(tones.manual)).toBe(' MANUAL ')
    expect(Str.Visual.strip(tones.success)).toBe(' PASS ')
    expect(Str.Visual.strip(tones.warn)).toBe(' WARN ')
    expect(Str.Visual.strip(code)).toBe('`release doctor`')
    expect(Str.Visual.strip(key)).toBe('Resume:')
    expect(Str.Visual.strip(section)).toBe('Apply\n─────')
  })
})
