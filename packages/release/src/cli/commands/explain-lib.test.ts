import { Cli } from '@kitz/cli'
import { Fs } from '@kitz/fs'
import { Pkg } from '@kitz/pkg'
import { Effect } from 'effect'
import { describe, expect, test } from 'bun:test'
import type { Package } from '../../api/analyzer/workspace.js'
import { createPackagePickerOptions, resolveExplainPackage } from './explain-lib.js'

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

const packages: readonly Package[] = [
  {
    scope: 'zeta',
    name: Pkg.Moniker.parse('@kitz/zeta'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/zeta/'),
  },
  {
    scope: 'alpha',
    name: Pkg.Moniker.parse('@kitz/alpha'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/alpha/'),
  },
  {
    scope: 'core',
    name: Pkg.Moniker.parse('@kitz/core'),
    path: Fs.Path.AbsDir.fromString('/repo/packages/core/'),
  },
]

describe('explain command package selection', () => {
  test('builds alphabetized picker options from workspace packages', () => {
    expect(createPackagePickerOptions(packages)).toEqual([
      {
        label: 'alpha',
        value: '@kitz/alpha',
        detail: '@kitz/alpha',
      },
      {
        label: 'core',
        value: '@kitz/core',
        detail: '@kitz/core',
      },
      {
        label: 'zeta',
        value: '@kitz/zeta',
        detail: '@kitz/zeta',
      },
    ])
  })

  test('accepts an explicit package without invoking the picker', async () => {
    let pickerCalls = 0

    const result = await Effect.runPromise(
      resolveExplainPackage({
        pkg: '@kitz/core',
        terminal: interactiveTerminal,
        pickPackage: () => {
          pickerCalls += 1
          return Effect.die('picker should not run')
        },
      }),
    )

    expect(result).toEqual({ _tag: 'resolved', value: '@kitz/core' })
    expect(pickerCalls).toBe(0)
  })

  test('uses the picker result when interactive package selection succeeds', async () => {
    const result = await Effect.runPromise(
      resolveExplainPackage({
        pkg: undefined,
        terminal: interactiveTerminal,
        pickPackage: () =>
          Effect.succeed({
            _tag: 'selected',
            value: '@kitz/alpha',
          }),
      }),
    )

    expect(result).toEqual({ _tag: 'resolved', value: '@kitz/alpha' })
  })

  test('explains why interactive package selection is unavailable', async () => {
    const result = await Effect.runPromise(
      resolveExplainPackage({
        pkg: undefined,
        terminal: disabledTerminal('stdin-and-stdout-not-tty'),
        pickPackage: () => Effect.die('picker should not run'),
      }),
    )

    expect(result._tag).toBe('missing')
    if (result._tag !== 'missing') {
      throw new Error('expected missing package selection')
    }

    expect(result.message).toContain('Pass <pkg>.')
    expect(result.message).toContain('both stdin and stdout')
  })

  test('reports cancelled and empty picker outcomes explicitly', async () => {
    const cancelled = await Effect.runPromise(
      resolveExplainPackage({
        pkg: undefined,
        terminal: interactiveTerminal,
        pickPackage: () => Effect.succeed({ _tag: 'cancelled' }),
      }),
    )
    const empty = await Effect.runPromise(
      resolveExplainPackage({
        pkg: undefined,
        terminal: interactiveTerminal,
        pickPackage: () => Effect.succeed({ _tag: 'empty' }),
      }),
    )

    expect(cancelled).toEqual({
      _tag: 'missing',
      message: 'Package selection cancelled. Pass <pkg> to run without the picker.',
    })
    expect(empty).toEqual({
      _tag: 'missing',
      message: 'Package selection has no available options. Pass <pkg> explicitly.',
    })
  })
})
