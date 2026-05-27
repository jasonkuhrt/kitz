import { Str } from '@kitz/core'
import * as fc from 'fast-check'
import { Cause, Effect, Fiber, Layer, Option, PlatformError, Queue, Terminal } from 'effect'
import { describe, expect, test } from 'bun:test'
import type { PickerKeyEvent, PickerOption } from './picker.js'
import {
  describeInteractiveTerminalRequirement,
  getPickerWindow,
  isInteractiveTerminal,
  movePickerCursor,
  pickOption,
  pickOptionWith,
  renderPickerFrame,
  resolveInteractiveCommandSelection,
  resolveInteractiveTerminalCapabilities,
} from './picker.js'

const ANSI_ALT_SCREEN_ENTER = '\u001b[?1049h'
const ANSI_ALT_SCREEN_EXIT = '\u001b[?1049l'
const ANSI_CURSOR_SHOW = '\u001b[?25h'

const pickerOptions = [
  { label: 'alpha', value: 'a', detail: 'first option' },
  { label: 'beta', value: 'b', detail: 'second option' },
  { label: 'gamma', value: 'c', detail: 'third option' },
  { label: 'delta', value: 'd', detail: 'fourth option' },
  { label: 'epsilon', value: 'e', detail: 'fifth option' },
] as const satisfies readonly PickerOption<string>[]

const mixedDetailOptions = [
  { label: 'alpha', value: 'a' },
  { label: 'beta', value: 'b', detail: 'second option' },
  { label: 'gamma', value: 'c' },
  { label: 'delta', value: 'd', detail: 'fourth option' },
  { label: 'epsilon', value: 'e' },
] as const satisfies readonly PickerOption<string>[]

const keyEvent = (name: string, overrides: Partial<PickerKeyEvent> = {}): PickerKeyEvent => ({
  ctrl: false,
  meta: false,
  name,
  shift: false,
  ...overrides,
})

const userInput = (name: string, overrides: Partial<Terminal.Key> = {}): Terminal.UserInput => ({
  input: Option.none(),
  key: {
    ctrl: false,
    meta: false,
    name,
    shift: false,
    ...overrides,
  },
})

const makeScriptedRuntime = (events: readonly PickerKeyEvent[]) => {
  const frames: string[] = []
  const remaining = [...events]

  return {
    frames,
    runtime: {
      display: (value: string) =>
        Effect.sync(() => {
          frames.push(value)
        }),
      readKey: Effect.sync(() => {
        const event = remaining.shift()
        if (!event) {
          throw new Error('No scripted key event remaining')
        }
        return event
      }),
    },
  }
}

const makeTerminalRig = async (options: { readonly failAtDisplayCall?: number } = {}) => {
  const outputs: string[] = []
  const queue = await Effect.runPromise(Queue.unbounded<Terminal.UserInput, Cause.Done>())

  const terminal = Terminal.make({
    columns: Effect.succeed(80),
    rows: Effect.succeed(24),
    readInput: Effect.succeed(queue),
    readLine: Effect.fail(new Terminal.QuitError()),
    display: (text) => {
      const call = outputs.length + 1
      const record = Effect.sync(() => {
        outputs.push(text)
      })

      if (options.failAtDisplayCall === call) {
        return record.pipe(
          Effect.andThen(
            Effect.fail(
              PlatformError.badArgument({
                module: 'picker.test',
                method: 'display',
                description: 'display failed in test rig',
              }),
            ),
          ),
        )
      }

      return record
    },
  })

  return {
    outputs,
    queue,
    layer: Layer.succeed(Terminal.Terminal)(terminal),
  }
}

const interactiveTerminal = {
  color: true,
  env: {},
  interactive: true,
  stdinIsTTY: true,
  stdoutIsTTY: true,
} as const

const disabledTerminal = (
  reason: 'ci' | 'stdin-not-tty' | 'stdout-not-tty' | 'stdin-and-stdout-not-tty',
) =>
  ({
    color: false,
    env: reason === 'ci' ? { CI: 'true' } : {},
    interactive: false,
    reason,
    stdinIsTTY: reason !== 'stdin-not-tty' && reason !== 'stdin-and-stdout-not-tty',
    stdoutIsTTY: reason !== 'stdout-not-tty' && reason !== 'stdin-and-stdout-not-tty',
  }) as const

describe('cli picker', () => {
  test('describes each terminal unavailability reason explicitly', () => {
    expect(describeInteractiveTerminalRequirement('ci')).toContain('CI environment flag')
    expect(describeInteractiveTerminalRequirement('stdin-not-tty')).toContain('stdin')
    expect(describeInteractiveTerminalRequirement('stdout-not-tty')).toContain('stdout')
    expect(describeInteractiveTerminalRequirement('stdin-and-stdout-not-tty')).toContain(
      'both stdin and stdout',
    )
  })

  test('resolves interactive command selection from explicit, disabled, selected, cancelled, and empty inputs', async () => {
    let pickerCalls = 0

    const explicit = await Effect.runPromise(
      resolveInteractiveCommandSelection({
        provided: 'official',
        terminal: interactiveTerminal,
        pick: () => {
          pickerCalls += 1
          return Effect.die('picker should not run')
        },
      }),
    )
    const disabled = await Effect.runPromise(
      resolveInteractiveCommandSelection({
        provided: undefined,
        terminal: disabledTerminal('stdout-not-tty'),
        pick: () => {
          pickerCalls += 1
          return Effect.die('picker should not run')
        },
      }),
    )
    const selected = await Effect.runPromise(
      resolveInteractiveCommandSelection({
        provided: undefined,
        terminal: interactiveTerminal,
        pick: () => Effect.succeed({ _tag: 'selected', value: 'candidate' } as const),
      }),
    )
    const cancelled = await Effect.runPromise(
      resolveInteractiveCommandSelection({
        provided: undefined,
        terminal: interactiveTerminal,
        pick: () => Effect.succeed({ _tag: 'cancelled' } as const),
      }),
    )
    const empty = await Effect.runPromise(
      resolveInteractiveCommandSelection({
        provided: undefined,
        terminal: interactiveTerminal,
        pick: () => Effect.succeed({ _tag: 'empty' } as const),
      }),
    )

    expect(explicit).toEqual({ _tag: 'resolved', value: 'official' })
    expect(disabled).toEqual({ _tag: 'missing', reason: 'stdout-not-tty' })
    expect(selected).toEqual({ _tag: 'resolved', value: 'candidate' })
    expect(cancelled).toEqual({ _tag: 'missing', reason: 'cancelled' })
    expect(empty).toEqual({ _tag: 'missing', reason: 'empty' })
    expect(pickerCalls).toBe(0)
  })

  test('resolves terminal capabilities from CI, color, and tty inputs', () => {
    expect(
      resolveInteractiveTerminalCapabilities({
        env: { CI: 'true', FORCE_COLOR: '1' },
        stdinIsTTY: true,
        stdoutIsTTY: true,
      }),
    ).toEqual(
      expect.objectContaining({
        color: true,
        interactive: false,
        reason: 'ci',
      }),
    )
    expect(
      resolveInteractiveTerminalCapabilities({
        color: false,
        env: { FORCE_COLOR: '1' },
        stdinIsTTY: true,
        stdoutIsTTY: true,
      }),
    ).toEqual(
      expect.objectContaining({
        color: false,
        interactive: true,
      }),
    )
    expect(
      resolveInteractiveTerminalCapabilities({
        env: { FORCE_COLOR: '1' },
        stdinIsTTY: true,
        stdoutIsTTY: false,
      }),
    ).toEqual(
      expect.objectContaining({
        color: true,
        interactive: false,
        reason: 'stdout-not-tty',
      }),
    )
    expect(
      resolveInteractiveTerminalCapabilities({
        env: { NO_COLOR: '1' },
        stdinIsTTY: false,
        stdoutIsTTY: false,
      }),
    ).toEqual(
      expect.objectContaining({
        color: false,
        interactive: false,
        reason: 'stdin-and-stdout-not-tty',
      }),
    )
    expect(resolveInteractiveTerminalCapabilities()).toEqual(
      expect.objectContaining({
        stdinIsTTY: process.stdin?.isTTY ?? false,
        stdoutIsTTY: process.stdout?.isTTY ?? false,
      }),
    )
    expect(isInteractiveTerminal({ stdinIsTTY: true, stdoutIsTTY: true })).toBe(true)
    expect(isInteractiveTerminal({ stdinIsTTY: false, stdoutIsTTY: true })).toBe(false)
  })

  test('movePickerCursor wraps within bounds for arbitrary cursor movements', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 49 }),
        fc.constantFrom(-1 as const, 1 as const),
        (total, indexSeed, direction) => {
          const index = indexSeed % total
          const next = movePickerCursor(index, direction, total)

          expect(next).toBeGreaterThanOrEqual(0)
          expect(next).toBeLessThan(total)
          expect(movePickerCursor(next, direction === 1 ? -1 : 1, total)).toBe(index)
        },
      ),
    )
    expect(movePickerCursor(5, 1, 0)).toBe(0)
  })

  test('getPickerWindow always includes the clamped cursor and uses a stable visible size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -10, max: 60 }),
        (total, index, maxVisible) => {
          const window = getPickerWindow(total, index, maxVisible)
          const expectedVisible = Math.max(1, Math.min(maxVisible, total))
          const clampedIndex = Math.min(Math.max(index, 0), total - 1)

          expect(window.start).toBeGreaterThanOrEqual(0)
          expect(window.end).toBeLessThanOrEqual(total)
          expect(window.end - window.start).toBe(expectedVisible)
          expect(clampedIndex).toBeGreaterThanOrEqual(window.start)
          expect(clampedIndex).toBeLessThan(window.end)
        },
      ),
    )
  })

  test('renders informative empty and scrolling picker frames in monochrome and color', () => {
    const empty = renderPickerFrame(
      {
        color: false,
        title: 'Select package',
        options: [],
      },
      0,
    )
    const scrolling = renderPickerFrame(
      {
        color: false,
        title: 'Select package',
        hint: 'Choose one package to continue.',
        options: pickerOptions,
        maxVisible: 3,
      },
      2,
    )
    const color = renderPickerFrame(
      {
        color: true,
        title: 'Select package',
        options: pickerOptions,
        maxVisible: 3,
      },
      2,
    )

    expect(empty).toContain('[PICK] Select package')
    expect(empty).toContain('No options are available for interactive selection.')
    expect(scrolling).toContain('Choose one package to continue.')
    expect(scrolling).toContain('... 1 earlier option')
    expect(scrolling).toContain('... 1 more option')
    expect(scrolling).toContain('> gamma')
    expect(scrolling).toContain('Use `Up/Down` or `j/k` to move')
    expect(color).toContain('\u001b[')
    expect(Str.Visual.strip(color)).toContain('> gamma')
  })

  test('renders plural overflow copy and omits detail rows when an option has no detail', () => {
    const more = renderPickerFrame(
      {
        color: false,
        title: 'Select package',
        options: mixedDetailOptions,
        maxVisible: 2,
      },
      0,
    )
    const earlier = renderPickerFrame(
      {
        color: false,
        title: 'Select package',
        options: mixedDetailOptions,
        maxVisible: 2,
      },
      4,
    )

    expect(more).toContain('... 3 more options')
    expect(more).not.toContain('  first option')
    expect(earlier).toContain('... 3 earlier options')
    expect(earlier).not.toContain('  fifth option')
  })

  test('returns empty without rendering when no picker options exist', async () => {
    const { frames, runtime } = makeScriptedRuntime([keyEvent('return')])

    const result = await Effect.runPromise(
      pickOptionWith(runtime, {
        title: 'Empty',
        options: [],
      }),
    )

    expect(result).toEqual({ _tag: 'empty' })
    expect(frames).toEqual([])
  })

  test('clamps the initial index before the first selection frame', async () => {
    const { frames, runtime } = makeScriptedRuntime([keyEvent('return')])

    const result = await Effect.runPromise(
      pickOptionWith(runtime, {
        color: false,
        initialIndex: 99,
        options: pickerOptions,
        title: 'Select package',
      }),
    )

    expect(result).toEqual({ _tag: 'selected', value: 'e' })
    expect(frames).toHaveLength(1)
    expect(frames[0]).toContain('> epsilon')
  })

  test('ignores unrelated keys and navigates with arrows and j/k', async () => {
    const { frames, runtime } = makeScriptedRuntime([
      keyEvent('x'),
      keyEvent('down'),
      keyEvent('up'),
      keyEvent('k'),
      keyEvent('j'),
      keyEvent('return'),
    ])

    const result = await Effect.runPromise(
      pickOptionWith(runtime, {
        color: false,
        initialIndex: 1,
        options: pickerOptions,
        title: 'Select package',
      }),
    )

    expect(result).toEqual({ _tag: 'selected', value: 'b' })
    expect(frames).toHaveLength(6)
    expect(frames[0]).toContain('> beta')
    expect(frames[1]).toContain('> beta')
    expect(frames[2]).toContain('> gamma')
    expect(frames[3]).toContain('> beta')
    expect(frames[4]).toContain('> alpha')
    expect(frames[5]).toContain('> beta')
  })

  test.each([
    ['escape', keyEvent('escape')],
    ['q', keyEvent('q')],
    ['ctrl+c', keyEvent('c', { ctrl: true })],
    ['ctrl+d', keyEvent('d', { ctrl: true })],
  ])('cancels when %s is pressed', async (_label, event) => {
    const { runtime } = makeScriptedRuntime([event])

    const result = await Effect.runPromise(
      pickOptionWith(runtime, {
        color: false,
        options: pickerOptions,
        title: 'Select package',
      }),
    )

    expect(result).toEqual({ _tag: 'cancelled' })
  })

  test('enters and exits the alternate screen around a successful terminal-backed picker session', async () => {
    const rig = await makeTerminalRig()
    await Effect.runPromise(Queue.offer(rig.queue, userInput('return')))

    const result = await Effect.runPromise(
      pickOption({
        color: false,
        initialIndex: 1,
        options: pickerOptions,
        title: 'Select package',
      }).pipe(Effect.provide(rig.layer)),
    )

    expect(result).toEqual({ _tag: 'selected', value: 'b' })
    expect(rig.outputs[0]).toContain(ANSI_ALT_SCREEN_ENTER)
    expect(rig.outputs[1]).toContain('Select package')
    expect(rig.outputs[2]).toContain(ANSI_CURSOR_SHOW)
    expect(rig.outputs[2]).toContain(ANSI_ALT_SCREEN_EXIT)
  })

  test('does not touch the terminal when pickOption receives no options', async () => {
    const rig = await makeTerminalRig()

    const result = await Effect.runPromise(
      pickOption({
        color: false,
        options: [],
        title: 'Empty',
      }).pipe(Effect.provide(rig.layer)),
    )

    expect(result).toEqual({ _tag: 'empty' })
    expect(rig.outputs).toEqual([])
  })

  test('treats a closed terminal input queue as a cancellation and restores terminal state', async () => {
    const rig = await makeTerminalRig()
    await Effect.runPromise(Queue.end(rig.queue))

    const result = await Effect.runPromise(
      pickOption({
        color: false,
        options: pickerOptions,
        title: 'Closed input picker',
      }).pipe(Effect.provide(rig.layer)),
    )

    expect(result).toEqual({ _tag: 'cancelled' })
    expect(rig.outputs[0]).toContain(ANSI_ALT_SCREEN_ENTER)
    expect(rig.outputs[1]).toContain('Closed input picker')
    expect(rig.outputs[2]).toContain(ANSI_ALT_SCREEN_EXIT)
  })

  test('restores terminal state when rendering fails', async () => {
    const rig = await makeTerminalRig({ failAtDisplayCall: 2 })

    const result = await Effect.runPromise(
      pickOption({
        color: false,
        options: pickerOptions,
        title: 'Broken picker',
      }).pipe(Effect.provide(rig.layer), Effect.result),
    )

    expect(result._tag).toBe('Failure')
    expect(rig.outputs[0]).toContain(ANSI_ALT_SCREEN_ENTER)
    expect(rig.outputs[1]).toContain('Broken picker')
    expect(rig.outputs[2]).toContain(ANSI_CURSOR_SHOW)
    expect(rig.outputs[2]).toContain(ANSI_ALT_SCREEN_EXIT)
  })

  test('restores terminal state when the picker fiber is interrupted', async () => {
    const rig = await makeTerminalRig()
    const fiber = Effect.runFork(
      pickOption({
        color: false,
        options: pickerOptions,
        title: 'Interruptible picker',
      }).pipe(Effect.provide(rig.layer)),
    )

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(rig.outputs.length).toBeGreaterThanOrEqual(2)

    await Effect.runPromise(Fiber.interrupt(fiber))

    expect(rig.outputs[0]).toContain(ANSI_ALT_SCREEN_ENTER)
    expect(rig.outputs[1]).toContain('Interruptible picker')
    expect(rig.outputs.at(-1)).toContain(ANSI_CURSOR_SHOW)
    expect(rig.outputs.at(-1)).toContain(ANSI_ALT_SCREEN_EXIT)
  })
})
