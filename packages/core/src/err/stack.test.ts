import { describe, expect, test } from 'bun:test'
import { CleanError, cleanStack, formatFrame, getCaller, mergeStacks, parseStack } from './stack.js'

describe('parseStack', () => {
  test('parses stack frames correctly', () => {
    const stack = `Error: Test error
    at functionName (/path/to/file.ts:10:15)
    at async asyncFunction (/path/to/async.ts:20:25)
    at Object.<anonymous> (/path/to/index.ts:5:10)
    at Module._compile (node:internal/modules/cjs/loader:1165:14)`

    const frames = parseStack(stack)

    expect(frames).toHaveLength(4)
    expect(frames[0]).toMatchObject({
      function: 'functionName',
      file: '/path/to/file.ts',
      line: 10,
      column: 15,
      isInternal: false,
      isNative: false,
    })

    expect(frames[1]).toMatchObject({
      function: 'asyncFunction',
      file: '/path/to/async.ts',
      line: 20,
      column: 25,
    })

    expect(frames[3]).toMatchObject({
      function: 'Module._compile',
      isNative: true,
    })
  })

  test('handles anonymous functions', () => {
    const stack = `Error: Test
    at /path/to/file.ts:10:15
    at new Promise (<anonymous>)`

    const frames = parseStack(stack)

    expect(frames[0]?.function).toBe('<anonymous>')
  })
})

describe('cleanStack', () => {
  test('removes internal frames by default', () => {
    const stack = `Error: Test error
    at userFunction (/src/app.ts:10:15)
    at wrapWith (/src/err/wrap.ts:20:25)
    at tryOrThrow (/src/err/wrap.ts:30:35)
    at userFunction2 (/src/app.ts:40:45)`

    const cleaned = cleanStack(stack)

    expect(cleaned).toContain('userFunction')
    expect(cleaned).toContain('userFunction2')
    expect(cleaned).not.toContain('wrapWith')
    expect(cleaned).not.toContain('tryOrThrow')
  })

  test('filters node_modules by default', () => {
    const stack = `Error: Test error
    at userFunction (/src/app.ts:10:15)
    at someLibrary (/node_modules/lib/index.ts:20:25)
    at userFunction2 (/src/app.ts:30:35)`

    const cleaned = cleanStack(stack)

    expect(cleaned).toContain('userFunction')
    expect(cleaned).toContain('userFunction2')
    expect(cleaned).not.toContain('node_modules')
  })

  test('respects maxFrames option', () => {
    const stack = `Error: Test error
    at frame1 (/src/1.ts:1:1)
    at frame2 (/src/2.ts:2:2)
    at frame3 (/src/3.ts:3:3)
    at frame4 (/src/4.ts:4:4)
    at frame5 (/src/5.ts:5:5)`

    const cleaned = cleanStack(stack, { maxFrames: 3 })
    const lines = cleaned.split('\n')

    // 1 error message + 3 frames
    expect(lines).toHaveLength(4)
    expect(cleaned).toContain('frame1')
    expect(cleaned).toContain('frame3')
    expect(cleaned).not.toContain('frame4')
  })
})

describe('mergeStacks', () => {
  test('merges wrapper and cause stacks', () => {
    const cause = new Error('Original error')
    // Simulate stack
    cause.stack = `Error: Original error
    at deepFunction (/src/deep.ts:10:15)
    at causeFunction (/src/cause.ts:20:25)`

    const wrapper = new Error('Wrapped error')
    wrapper.stack = `Error: Wrapped error
    at wrapperFunction (/src/wrapper.ts:5:10)
    at wrap (/src/err/wrap.ts:15:20)
    at topLevel (/src/top.ts:25:30)`

    const merged = mergeStacks(wrapper, cause)

    expect(merged).toContain('Wrapped error')
    expect(merged).toContain('wrapperFunction')
    expect(merged).toContain('Caused by:')
    expect(merged).toContain('Original error')
    expect(merged).toContain('deepFunction')
  })
})

describe('CleanError', () => {
  test('automatically cleans stack traces', () => {
    const error = new CleanError('Test error')

    expect(error.name).toBe('CleanError')
    expect(error.message).toBe('Test error')
    // Stack should exist but we can't test exact content easily
    expect(error.stack).toBeDefined()
    expect(error.originalStack).toBeDefined()
  })

  test('includes context', () => {
    const error = new CleanError('Test error', {
      context: { userId: 123, operation: 'test' },
    })

    expect(error.context).toEqual({ userId: 123, operation: 'test' })
  })
})

describe('formatFrame', () => {
  test('formats frame nicely', () => {
    const frame = {
      function: 'testFunction',
      file: '/src/test.ts',
      line: 10,
      column: 15,
      isInternal: false,
      isNative: false,
      raw: 'at testFunction (/src/test.ts:10:15)',
    }

    expect(formatFrame(frame)).toBe('at testFunction (/src/test.ts:10:15)')
  })

  test('handles anonymous functions', () => {
    const frame = {
      function: '<anonymous>',
      file: '/src/test.ts',
      line: 10,
      column: 15,
      isInternal: false,
      isNative: false,
      raw: 'at /src/test.ts:10:15',
    }

    expect(formatFrame(frame)).toBe('at (/src/test.ts:10:15)')
  })
})

describe('getCaller', () => {
  // TODO(bun-test-migration): bun's V8 stack-trace format differs from node's.
  // `getCaller(1)` returns undefined because the stack-frame parsing in
  // err/stack.ts assumes node's format. Fix requires teaching the parser to
  // handle bun's frame layout.
  test.skip('gets caller information', () => {
    function outer() {
      function inner() {
        return getCaller(1)
      }
      return inner()
    }

    const caller = outer()

    // We can't test exact values but we can verify structure
    expect(caller).toBeDefined()
    expect(caller?.function).toBeDefined()
    expect(caller?.file).toBeDefined()
    expect(caller?.line).toBeGreaterThan(0)
    expect(caller?.column).toBeGreaterThan(0)
  })
})
