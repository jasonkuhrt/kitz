import { Effect, Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { ArgvSchema, isProcessArgvLoose, parseArgv } from './argv.js'
import { getCommandTarget } from './commend-target.js'

describe('argv', () => {
  test('isProcessArgvLoose accepts REPL-style argv and rejects invalid shapes', () => {
    expect(isProcessArgvLoose(['bun'])).toBe(true)
    expect(isProcessArgvLoose(['bun', 'script.ts', '--watch'])).toBe(true)
    expect(isProcessArgvLoose([])).toBe(false)
    expect(isProcessArgvLoose(['bun', 1])).toBe(false)
    expect(isProcessArgvLoose('bun script.ts')).toBe(false)
  })

  test('parseArgv decodes normal process argv', async () => {
    const argv = await Effect.runPromise(parseArgv(['bun', 'cli.ts', '--watch', 'input.txt']))

    expect(argv).toEqual({
      execPath: 'bun',
      scriptPath: 'cli.ts',
      args: ['--watch', 'input.txt'],
    })
  })

  test('parseArgv decodes REPL argv without a script path', async () => {
    const argv = await Effect.runPromise(parseArgv(['bun']))

    expect(argv).toEqual({
      execPath: 'bun',
      scriptPath: null,
      args: [],
    })
  })

  test('ArgvSchema encodes argv objects back to process argv', () => {
    expect(
      Schema.encodeSync(ArgvSchema)({
        execPath: 'bun',
        scriptPath: 'cli.ts',
        args: ['--watch'],
      }),
    ).toEqual(['bun', 'cli.ts', '--watch'])

    expect(
      Schema.encodeSync(ArgvSchema)({
        execPath: 'bun',
        scriptPath: null,
        args: ['repl-command'],
      }),
    ).toEqual(['bun', 'repl-command'])
  })
})

describe('getCommandTarget', () => {
  test('returns a subcommand target for positional args', () => {
    expect(
      getCommandTarget({
        execPath: 'bun',
        scriptPath: 'cli.ts',
        args: [' build ', '--watch'],
      }),
    ).toEqual({
      type: 'sub',
      name: 'build',
      args: ['--watch'],
    })
  })

  test('falls back to the default command for named parameters and blank args', () => {
    expect(
      getCommandTarget({
        execPath: 'bun',
        scriptPath: 'cli.ts',
        args: ['--help'],
      }),
    ).toEqual({
      type: 'default',
      args: ['--help'],
    })

    expect(
      getCommandTarget({
        execPath: 'bun',
        scriptPath: 'cli.ts',
        args: ['   '],
      }),
    ).toEqual({
      type: 'default',
      args: ['   '],
    })

    expect(
      getCommandTarget({
        execPath: 'bun',
        scriptPath: 'cli.ts',
        args: [],
      }),
    ).toEqual({
      type: 'default',
      args: [],
    })
  })
})
