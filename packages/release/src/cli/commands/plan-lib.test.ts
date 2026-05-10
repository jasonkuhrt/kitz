import { Cli } from '@kitz/cli'
import { Array as A, Effect } from 'effect'
import { describe, expect, test } from 'bun:test'
import { lifecyclePickerOptions, resolvePlanLifecycle } from './plan-lib.js'

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

describe('plan command lifecycle selection', () => {
  test('keeps the picker options aligned with the supported lifecycle values', () => {
    expect(
      A.map(lifecyclePickerOptions, (option) => [option.label, option.value, option.detail]),
    ).toEqual([
      ['official', 'official', 'Publish semver releases to the default npm dist-tag.'],
      ['candidate', 'candidate', 'Publish prereleases to the candidate dist-tag.'],
      ['ephemeral', 'ephemeral', 'Publish PR-scoped integration builds.'],
    ])
  })

  test('accepts an explicit lifecycle without invoking the picker', async () => {
    let pickerCalls = 0

    const result = await Effect.runPromise(
      resolvePlanLifecycle({
        lifecycle: 'candidate',
        terminal: interactiveTerminal,
        pickLifecycle: () => {
          pickerCalls += 1
          return Effect.die('picker should not run')
        },
      }),
    )

    expect(result).toEqual({ _tag: 'resolved', value: 'candidate' })
    expect(pickerCalls).toBe(0)
  })

  test('uses the picker result when interactive lifecycle selection succeeds', async () => {
    const result = await Effect.runPromise(
      resolvePlanLifecycle({
        lifecycle: undefined,
        terminal: interactiveTerminal,
        pickLifecycle: () =>
          Effect.succeed({
            _tag: 'selected',
            value: 'ephemeral',
          }),
      }),
    )

    expect(result).toEqual({ _tag: 'resolved', value: 'ephemeral' })
  })

  test('explains why interactive lifecycle selection is unavailable', async () => {
    const result = await Effect.runPromise(
      resolvePlanLifecycle({
        lifecycle: undefined,
        terminal: disabledTerminal('ci'),
        pickLifecycle: () => Effect.die('picker should not run'),
      }),
    )

    expect(result._tag).toBe('missing')
    if (result._tag !== 'missing') {
      throw new Error('expected missing lifecycle selection')
    }

    expect(result.message).toContain('--lifecycle <official|candidate|ephemeral>')
    expect(result.message).toContain('CI environment flag')
  })

  test('reports cancelled and empty picker outcomes explicitly', async () => {
    const cancelled = await Effect.runPromise(
      resolvePlanLifecycle({
        lifecycle: undefined,
        terminal: interactiveTerminal,
        pickLifecycle: () => Effect.succeed({ _tag: 'cancelled' }),
      }),
    )
    const empty = await Effect.runPromise(
      resolvePlanLifecycle({
        lifecycle: undefined,
        terminal: interactiveTerminal,
        pickLifecycle: () => Effect.succeed({ _tag: 'empty' }),
      }),
    )

    expect(cancelled).toEqual({
      _tag: 'missing',
      message:
        'Release lifecycle selection cancelled. Pass --lifecycle <official|candidate|ephemeral> to run without the picker.',
    })
    expect(empty).toEqual({
      _tag: 'missing',
      message:
        'Release lifecycle selection has no available options. Pass --lifecycle <official|candidate|ephemeral> explicitly.',
    })
  })
})
