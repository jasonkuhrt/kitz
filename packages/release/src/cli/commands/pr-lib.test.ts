import { Cli } from '@kitz/cli'
import { describe, expect, test } from 'bun:test'
import { Array as A, Effect } from 'effect'
import { formatHelp, parseAction, prActionPickerOptions, resolvePrAction } from './pr-lib.js'

const interactiveTerminal = Cli.Picker.resolveInteractiveTerminalCapabilities({
  color: true,
  env: {},
  stdinIsTTY: true,
  stdoutIsTTY: true,
})

const disabledTerminal = (reason: Cli.Picker.InteractiveTerminalUnavailabilityReason) =>
  Cli.Picker.resolveInteractiveTerminalCapabilities({
    color: false,
    env: reason === 'ci' ? { CI: 'true' } : {},
    stdinIsTTY: reason !== 'stdin-not-tty' && reason !== 'stdin-and-stdout-not-tty',
    stdoutIsTTY: reason !== 'stdout-not-tty' && reason !== 'stdin-and-stdout-not-tty',
  })

describe('release pr command helpers', () => {
  test('parses preview flags in any supported order and normalizes explicit remotes', () => {
    expect(parseAction(['preview', '--check-only', '--remote', ' fork '])).toEqual({
      _tag: 'preview',
      checkOnly: true,
      remote: 'fork',
    })
    expect(parseAction(['preview'])).toEqual({
      _tag: 'preview',
      checkOnly: false,
    })
  })

  test('rejects preview remote overrides without a usable value', () => {
    expect(parseAction(['preview', '--remote'])).toBeNull()
    expect(parseAction(['preview', '--remote', '   '])).toBeNull()
    expect(parseAction(['preview', '--remote', '--check-only'])).toBeNull()
  })

  test('parses title actions and rejects unknown commands', () => {
    expect(parseAction(['title', 'suggest'])).toEqual({ _tag: 'title', action: 'suggest' })
    expect(parseAction(['title', 'apply'])).toEqual({ _tag: 'title', action: 'apply' })
    expect(parseAction(['title'])).toBeNull()
    expect(parseAction(['noop', 'suggest'])).toBeNull()
    expect(parseAction(['preview', '--unknown'])).toBeNull()
    expect(parseAction(['title', 'preview'])).toBeNull()
  })

  test('documents the remote override in command help', () => {
    expect(formatHelp()).toContain('Pass `--remote <name>` to override the PR diff remote')
  })

  test('keeps interactive action choices aligned with the help surface', () => {
    expect(A.map(prActionPickerOptions, (option) => option.label)).toEqual([
      'preview',
      'title suggest',
      'title apply',
    ])
    expect(formatHelp()).toContain('preview')
    expect(formatHelp()).toContain('title suggest')
    expect(formatHelp()).toContain('title apply')
  })

  test('prefers explicit action arguments over the interactive picker', async () => {
    let pickerCalls = 0

    const result = await Effect.runPromise(
      resolvePrAction({
        args: ['title', 'apply'],
        terminal: disabledTerminal('ci'),
        pickAction: () => {
          pickerCalls += 1
          return Effect.die('picker should not run')
        },
      }),
    )

    expect(result).toEqual({
      _tag: 'resolved',
      action: { _tag: 'title', action: 'apply' },
    })
    expect(pickerCalls).toBe(0)
  })

  test('uses the interactive picker result when no action arguments are provided', async () => {
    const result = await Effect.runPromise(
      resolvePrAction({
        args: [],
        terminal: interactiveTerminal,
        pickAction: () =>
          Effect.succeed({
            _tag: 'selected',
            value: { _tag: 'preview', checkOnly: false },
          }),
      }),
    )

    expect(result).toEqual({
      _tag: 'resolved',
      action: { _tag: 'preview', checkOnly: false },
    })
  })

  test('explains missing interactive support when no action arguments are provided', async () => {
    const result = await Effect.runPromise(
      resolvePrAction({
        args: [],
        terminal: disabledTerminal('stdout-not-tty'),
        pickAction: () => Effect.die('picker should not run'),
      }),
    )

    expect(result._tag).toBe('invalid')
    if (result._tag !== 'invalid') {
      throw new Error('expected invalid PR action result')
    }

    expect(result.showHelp).toBe(true)
    expect(result.message).toContain('Missing PR action')
    expect(result.message).toContain('stdout to be a TTY')
  })

  test('reports cancelled and empty interactive picker outcomes without help spam', async () => {
    const cancelled = await Effect.runPromise(
      resolvePrAction({
        args: [],
        terminal: interactiveTerminal,
        pickAction: () => Effect.succeed({ _tag: 'cancelled' }),
      }),
    )
    const empty = await Effect.runPromise(
      resolvePrAction({
        args: [],
        terminal: interactiveTerminal,
        pickAction: () => Effect.succeed({ _tag: 'empty' }),
      }),
    )

    expect(cancelled).toEqual({
      _tag: 'invalid',
      message:
        'PR action selection cancelled. Re-run with `release pr preview` or `release pr title <suggest|apply>`.',
      showHelp: false,
    })
    expect(empty).toEqual({
      _tag: 'invalid',
      message:
        'PR action selection has no available options. Re-run with `release pr preview` or `release pr title <suggest|apply>`.',
      showHelp: false,
    })
  })

  test('reports invalid action arguments with help', async () => {
    const result = await Effect.runPromise(
      resolvePrAction({
        args: ['title', 'preview'],
        terminal: interactiveTerminal,
        pickAction: () => Effect.die('picker should not run'),
      }),
    )

    expect(result).toEqual({
      _tag: 'invalid',
      message: 'Expected `release pr preview` or `release pr title <suggest|apply>`.',
      showHelp: true,
    })
  })
})
