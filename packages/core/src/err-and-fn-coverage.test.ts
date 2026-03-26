import { Effect, Schema } from 'effect'
import { describe, expect, test, vi } from 'vitest'
import { TaggedContextualError, hasTag } from './err/contextual.js'
import { guardNull, log, logUnsafe, throwNull } from './err/__.js'
import { tryCatch, tryCatchIgnore, tryCatchify, tryOr, tryOrAsync } from './err/try.js'
import { ensure, is, isAbortError, isAggregateError } from './err/type.js'
import { analyzeFunction, isUnary } from './fn/analyze.js'
import { $identityPartial, applySecond, bind, is as isFunction, noop } from './fn/core/base.js'
import { curry, flipCurried, uncurry } from './fn/core/curry.js'

describe('core error and function coverage', () => {
  test('covers contextual tagged errors', () => {
    const FileError = TaggedContextualError('FileError', ['io', 'fatal'] as const, {
      context: Schema.Struct({ path: Schema.String }),
      message: (context) => `Missing ${context.path}`,
    })

    const error = new FileError({
      context: { path: 'README.md' },
      cause: new Error('missing'),
    })

    expect(error._tag).toBe('FileError')
    expect(error.tags).toEqual(['io', 'fatal'])
    expect(FileError.tags).toEqual(['io', 'fatal'])
    expect(error.message).toBe('Missing README.md')
    expect(error.cause).toBeInstanceOf(Error)
    expect(hasTag(error, 'fatal')).toBe(true)
    expect(hasTag(error, 'network')).toBe(false)
  })

  test('covers error logging and null guards', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const error = new Error('boom')

    Effect.runSync(log(error))
    logUnsafe(error)
    expect(spy).toHaveBeenCalledTimes(2)

    expect(throwNull('oak')).toBe('oak')
    expect(() => throwNull(null, 'missing value')).toThrow('missing value')

    const guarded = guardNull((value: string | null) => value, 'guarded')
    expect(guarded('oak')).toBe('oak')
    expect(() => guarded(null)).toThrow('guarded')

    spy.mockRestore()
  })

  test('covers try helpers', async () => {
    const parseJsonSafe = tryCatchify(JSON.parse)
    expect(parseJsonSafe('{"ok":true}')).toEqual({ ok: true })
    expect(parseJsonSafe('{')).toBeInstanceOf(Error)

    class NetworkError extends Error {}
    const throwsNetwork = tryCatchify(() => {
      throw new NetworkError('offline')
    }, [(error): error is NetworkError => error instanceof NetworkError])
    expect(throwsNetwork()).toBeInstanceOf(NetworkError)

    expect(tryCatch(() => 1)).toBe(1)
    expect(await tryCatch(Promise.resolve(2))).toBe(2)
    expect(
      tryCatch(() => {
        throw new Error('caught')
      }),
    ).toBeInstanceOf(Error)
    expect(() =>
      tryCatch(() => {
        throw 'boom'
      }, [(error): error is TypeError => error instanceof TypeError]),
    ).toThrow('boom')

    expect(tryCatchIgnore(() => 'ok')).toBe('ok')
    expect(
      tryCatchIgnore(() => {
        throw new Error('ignore')
      }),
    ).toBeUndefined()
    expect(
      await tryCatchIgnore(async () => {
        throw new Error('ignore async')
      }),
    ).toBeUndefined()

    expect(tryOr(() => 1, 'fallback')).toBe(1)
    expect(
      tryOr(() => {
        throw new Error('fallback')
      }, 'fallback'),
    ).toBe('fallback')
    expect(
      await tryOr(
        () => Promise.resolve(1),
        async () => 2,
      ),
    ).toBe(1)
    expect(
      await tryOrAsync(
        () => {
          throw new Error('fallback')
        },
        async () => 2,
      ),
    ).toBe(2)
  })

  test('covers error type helpers', () => {
    const error = new Error('boom')
    const aggregateError = new AggregateError([error], 'aggregate')
    const abortLike = Object.assign(new Error('aborted'), { name: 'AbortError', code: 20 })

    expect(is(error)).toBe(true)
    expect(is('boom')).toBe(false)
    expect(isAggregateError(aggregateError)).toBe(true)
    expect(isAggregateError(error)).toBe(false)
    expect(isAbortError(abortLike)).toBe(true)
    expect(isAbortError(error)).toBe(false)

    expect(ensure(error)).toBe(error)
    expect(ensure('boom').message).toBe('boom')
    expect(ensure({ boom: true }).message).toBe('[object Object]')
  })

  test('covers function analysis helpers', () => {
    const analyzed = analyzeFunction((name, { count, ready: isReady }) => {
      return `${name}:${count}:${isReady}`
    })

    expect(analyzed.parameters).toEqual([
      { type: 'name', value: 'name' },
      { type: 'destructured', names: ['count', 'ready'] },
    ])
    expect(analyzed.body).toBe('return `${name}:${count}:${isReady}`;')
    expect(analyzeFunction(() => 42)).toEqual({ body: '42', parameters: [] })
    expect(isUnary((value) => value)).toBe(true)
    expect(isUnary(() => 42)).toBe(false)
    expect(isUnary((a, b) => a + b)).toBe(false)
  })

  test('covers function core utilities', () => {
    expect(isFunction(() => null)).toBe(true)
    expect(isFunction('oak')).toBe(false)
    expect(bind((prefix: string, suffix: string) => prefix + suffix, 'oak')('!')).toBe('oak!')
    expect(noop()).toBeUndefined()
    expect($identityPartial({ nested: { ok: true } })).toEqual({ nested: { ok: true } })

    const appendBang = applySecond((prefix: string) => (suffix: string) => prefix + suffix, '!')
    expect(appendBang('oak')).toBe('oak!')
  })

  test('covers currying helpers', () => {
    const add = (a: number, b: number) => a + b
    const curriedAdd = curry(add)
    expect(curriedAdd(1)(2)).toBe(3)

    const format = curry(
      (left: string, middle: string, right: string) => `${left}${middle}${right}`,
    )
    expect(format('a')('b')('c')).toBe('abc')

    const isOak = curry((expected: string, value: string) => value === expected)
    expect(isOak('oak')('oak')).toBe(true)

    const uncurriedAdd = uncurry((a: number) => (b: number) => a + b)
    expect(uncurriedAdd(1, 2)).toBe(3)

    const flippedSubtract = flipCurried((a: number) => (b: number) => a - b)
    expect(flippedSubtract(1)(5)).toBe(4)
  })
})
