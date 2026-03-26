import { describe, expect, test } from 'vitest'
import { inspect } from './err/inspect.js'
import {
  tryAllOrRethrow,
  tryOrAsyncOn,
  tryOrAsyncWith,
  tryOrNull,
  tryOrOn,
  tryOrRethrow,
  tryOrUndefined,
  tryOrWith,
} from './err/try.js'

const restoreEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

describe('core error inspection and try coverage', () => {
  test('covers inspect environment overrides and help output', () => {
    const previousColor = process.env['ERROR_DISPLAY_COLOR']
    const previousShowHelp = process.env['ERROR_DISPLAY_SHOW_HELP']

    process.env['ERROR_DISPLAY_COLOR'] = 'false'
    process.env['ERROR_DISPLAY_SHOW_HELP'] = 'true'

    try {
      const output = inspect(new Error('boom'), { maxFrames: 0 })

      expect(output).toContain('Error: boom')
      expect(output).toContain('Environment Variable Configuration:')
      expect(output).toContain('ERROR_DISPLAY_COLOR = false')
      expect(output).toContain('ERROR_DISPLAY_SHOW_HELP = true')
    } finally {
      restoreEnv('ERROR_DISPLAY_COLOR', previousColor)
      restoreEnv('ERROR_DISPLAY_SHOW_HELP', previousShowHelp)
    }
  })

  test('covers inspect nested causes and aggregate errors', () => {
    const cause = new Error('cause')
    const child = Object.assign(new Error('child'), {
      context: { userId: 1, mode: 'strict' as const },
    })
    const nestedAggregate = new AggregateError(
      [new AggregateError([new Error('leaf')], 'branch aggregate')],
      'nested aggregate',
    )
    const root = new AggregateError([child, nestedAggregate], 'root aggregate')
    ;(root as Error & { cause?: Error }).cause = cause

    const output = inspect(root, {
      color: false,
      showHelp: false,
      maxFrames: 1,
    })

    expect(output).toContain('AggregateError: root aggregate')
    expect(output).toContain('0 ├─ Error: child')
    expect(output).toContain('1 ├─ AggregateError: nested aggregate')
    expect(output).toContain('userId')
    expect(output).toContain('[contains 1 error]')
    expect(output).toContain('└─ AggregateError: branch aggregate')
    expect(output).toContain('Error: cause')
    expect(output).toContain('    └')
  })

  test('covers try helper fallbacks and rethrow variants', async () => {
    expect(
      tryOrOn(() => {
        throw new Error('boom')
      })(() => 'fallback'),
    ).toBe('fallback')

    expect(
      tryOrWith('fallback')(() => {
        throw new Error('boom')
      }),
    ).toBe('fallback')

    expect(
      tryOrUndefined(() => {
        throw new Error('boom')
      }),
    ).toBeUndefined()

    expect(
      tryOrNull(() => {
        throw new Error('boom')
      }),
    ).toBeNull()

    await expect(
      tryOrAsyncOn(() => Promise.reject(new Error('boom')))(async () => 'fallback'),
    ).resolves.toBe('fallback')

    await expect(
      tryOrAsyncWith(async () => 'fallback')(() => {
        throw new Error('boom')
      }),
    ).resolves.toBe('fallback')

    expect(() =>
      tryOrRethrow(() => {
        throw new Error('boom')
      }, 'outer'),
    ).toThrow('outer')

    expect(() =>
      tryOrRethrow(
        () => {
          throw new Error('boom')
        },
        (cause) => new TypeError(`wrapped ${cause.message}`),
      ),
    ).toThrow(TypeError)

    await expect(
      tryOrRethrow(
        async () => {
          throw new Error('boom')
        },
        { message: 'async outer', context: { source: 'test' } },
      ),
    ).rejects.toThrow('async outer')
  })

  test('covers tryAllOrRethrow success and aggregate failures', async () => {
    await expect(tryAllOrRethrow([() => 1, async () => 2] as const, 'unused')).resolves.toEqual([
      1, 2,
    ])

    await expect(
      tryAllOrRethrow(
        [
          () => 1,
          () => {
            throw new Error('boom')
          },
          async () => {
            throw new Error('pow')
          },
        ] as const,
        'wrapped',
      ),
    ).rejects.toMatchObject({
      name: 'AggregateError',
      message: 'wrapped',
    })

    await expect(
      tryAllOrRethrow(
        [
          () => {
            throw new Error('boom')
          },
        ] as const,
        (cause) => new TypeError(`wrapped ${cause.message}`),
      ),
    ).rejects.toBeInstanceOf(AggregateError)
  })
})
