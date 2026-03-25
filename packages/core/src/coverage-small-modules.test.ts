import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import { format as formatDuration } from './date/duration.js'
import { ErrorInternal } from './err/internal.js'
import { endo } from './fn/endo.js'
import { lazy as fnLazy, resolveLazy as resolveFnLazy } from './fn/lazy.js'
import { isAnyFunction } from './fn/predicates.js'
import { TypeofTypesEnum, typeGuard } from './lang/core/lang.js'
import {
  isPrimitive,
  isSymbol as isLangSymbol,
  negatedTypeGuard,
  PrimitiveArb,
  ReferenceArb,
  ValueArb,
} from './lang/lang.js'
import { neverCase, panic, throw as throwValue, todo } from './lang/never.js'
import { isNonNull } from './null/null.js'
import { mapValues } from './obj/update.js'
import { patternFor, patternForSchema, patternForV1Schema } from './pat/factories.js'
import { create as createRecord, is as isRecord, merge as mergeRecord } from './rec/rec.js'
import {
  is as isSameReference,
  isOn,
  isReferenceEquality,
  isValueEquality,
  isnt,
  isntOn,
} from './ref/ref.js'
import { Builder } from './str/builder.js'
import {
  camel,
  capAll,
  capFirst,
  constant,
  kebab,
  pascal,
  snake,
  title,
  uncapFirst,
} from './str/case/case.js'
import { length } from './str/length.js'
import { ensureEnd, titlizeSlug } from './str/misc.js'
import { table } from './str/table.js'
import { interpolate, templateVariablePattern } from './str/template.js'
import { Empty, isEmpty } from './str/type.js'
import { isntTypeWith, isTypeWith } from './ts/type-guards.js'
import { is as isUndefined, isnt as isDefined } from './undefined/is.js'
import {
  identityProxy,
  isSymbol as isValueSymbol,
  lazy as valueLazy,
  resolveLazy,
  resolveLazyFactory,
} from './value/value.js'

describe('core small-module coverage', () => {
  test('covers basic type guards and value helpers', () => {
    expect(isUndefined(undefined)).toBe(true)
    expect(isUndefined(null)).toBe(false)
    expect(isDefined('oak')).toBe(true)
    expect(isDefined(undefined)).toBe(false)

    expect(isEmpty('')).toBe(true)
    expect(isEmpty('oak')).toBe(false)
    expect(Empty).toBe('')

    expect(isNonNull('oak')).toBe(true)
    expect(isNonNull(null)).toBe(false)

    expect(isValueSymbol(Symbol.for('value'))).toBe(true)
    expect(isValueSymbol('value')).toBe(false)
  })

  test('covers string formatting helpers', () => {
    expect(titlizeSlug('hello/world-of_tests')).toBe('Hello World Of Tests')
    expect(ensureEnd('hello', '!')).toBe('hello!')
    expect(ensureEnd('hello!', '!')).toBe('hello!')
    expect(length('oak')).toBe(3)

    const greeting = interpolate('Hello ${name} from ${place}')
    expect(greeting({ name: 'Oak', place: 'kitz' })).toBe('Hello Oak from kitz')
    expect([...`${'${name} ${value}'}`.matchAll(templateVariablePattern)].map((match) => match[1])).toEqual([
      'name',
      'value',
    ])

    expect(camel('hello-world')).toBe('helloWorld')
    expect(kebab('HelloWorld')).toBe('hello-world')
    expect(pascal('hello-world')).toBe('HelloWorld')
    expect(snake('helloWorld')).toBe('hello_world')
    expect(constant('helloWorld')).toBe('HELLO_WORLD')
    expect(title('hello-world_of oak')).toBe('Hello World Of Oak')
    expect(capAll('oak')).toBe('OAK')
    expect(uncapFirst('Oak')).toBe('oak')
    expect(capFirst('oak')).toBe('Oak')
  })

  test('covers string builders and tables', () => {
    const joined = Builder({ join: ', ' })
    joined('alpha', null, 'beta')
    expect(joined.render()).toBe('alpha, beta')
    expect(joined.toString()).toBe('alpha, beta')

    const templated = Builder()
    templated`hello ${'world'}`
    templated()
    expect(templated.state.lines).toEqual(['hello world', ''])

    expect(
      table({
        data: { name: 'Oak', mode: 'strict' },
      }),
    ).toBe('name \u2192 Oak\nmode \u2192 strict')

    expect(
      table({
        data: { short: 'a', longer: 'b' },
        separator: ' = ',
        separatorAlignment: false,
      }),
    ).toBe('short = \u00A0a\nlonger = b')
  })

  test('covers function and lazy helpers', () => {
    const object = { name: 'oak' }
    expect(endo(object)).toBe(object)
    expect(isAnyFunction(() => 1)).toBe(true)
    expect(isAnyFunction(1)).toBe(false)

    const fnThunk = fnLazy('oak')
    expect(fnThunk()).toBe('oak')
    expect(resolveFnLazy(fnThunk)).toBe('oak')
    expect(resolveFnLazy('oak')).toBe('oak')

    const valueThunk = valueLazy({ mode: 'strict' as const })
    expect(valueThunk()).toEqual({ mode: 'strict' })
    expect(resolveLazy(valueThunk)).toEqual({ mode: 'strict' })
    expect(resolveLazy('ready')).toBe('ready')
    expect(resolveLazyFactory(() => 42)()).toBe(42)
    expect(identityProxy.foo.bar.baz).toBe(identityProxy)
  })

  test('covers language helpers and runtime arbitraries', () => {
    const isOak = typeGuard<'oak'>('oak')
    expect(isOak('oak')).toBe(true)
    expect(isOak('pine')).toBe(false)

    const isNumber = typeGuard<number>((value) => typeof value === TypeofTypesEnum.number)
    expect(isNumber(1)).toBe(true)
    expect(isNumber('1')).toBe(false)

    const isNotString = negatedTypeGuard<string>((value) => typeof value === 'string')
    expect(isNotString('oak')).toBe(false)
    expect(isNotString(1)).toBe(true)

    const isNotNull = negatedTypeGuard<null>(null)
    expect(isNotNull(null)).toBe(false)
    expect(isNotNull('oak')).toBe(true)

    expect(isPrimitive('oak')).toBe(true)
    expect(isPrimitive(1)).toBe(true)
    expect(isPrimitive(null)).toBe(true)
    expect(isPrimitive({ name: 'oak' })).toBe(false)
    expect(isLangSymbol(Symbol.for('lang'))).toBe(true)
    expect(isLangSymbol('lang')).toBe(false)

    expect(ValueArb).toBeDefined()
    expect(ReferenceArb).toBeDefined()
    expect(PrimitiveArb).toBeDefined()
  })

  test('covers throwing helpers', () => {
    try {
      panic('panic message', 'boom')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('panic message')
      expect((error as Error).cause).toBe('boom')
    }

    expect(() => neverCase('boom' as never)).toThrow('Exhaustive check failed')
    expect(() => todo('ship it')).toThrow('todo: ship it')

    const marker = { marker: true }
    try {
      throwValue(marker)
    } catch (error) {
      expect(error).toBe(marker)
    }
  })

  test('covers duration formatting thresholds', () => {
    expect(formatDuration(500)).toEqual({ value: 500, unit: 'ms' })
    expect(formatDuration(10_000)).toEqual({ value: 10, unit: 's' })
    expect(formatDuration(100_000)).toEqual({ value: 2, unit: 'm' })
    expect(formatDuration(3_600_000)).toEqual({ value: 1, unit: 'h' })
    expect(formatDuration(172_800_000)).toEqual({ value: 2, unit: 'd' })
    expect(formatDuration(864_000_000)).toEqual({ value: Infinity, unit: 'max' })
  })

  test('covers internal error construction', () => {
    const defaultError = new ErrorInternal()
    expect(defaultError._tag).toBe('ErrorInternal')
    expect(defaultError.message).toBe('Something went wrong.')

    const cause = new Error('cause')
    const customError = new ErrorInternal({
      message: 'Custom message',
      context: { phase: 'test' },
      cause,
    })

    expect(customError.message).toBe('Custom message')
    expect(customError.context).toEqual({ phase: 'test' })
    expect(customError.cause).toBe(cause)
  })

  test('covers object, record, reference, and pattern helpers', () => {
    expect(mapValues({ a: 1, b: 2 }, (value, key) => `${String(key)}:${value * 2}`)).toEqual({
      a: 'a:2',
      b: 'b:4',
    })

    expect(isRecord({ name: 'oak' })).toBe(true)
    expect(isRecord(Object.create(null))).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(new Date())).toBe(false)

    const created = createRecord<number>()
    created.count = 1
    expect(created).toEqual({ count: 1 })
    expect(mergeRecord({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })

    const reference = { id: 1 }
    const sameReference = reference
    const otherReference = { id: 1 }
    expect(isSameReference(reference, sameReference)).toBe(true)
    expect(isSameReference(reference, otherReference)).toBe(false)
    expect(isOn(reference)(sameReference)).toBe(true)
    expect(isOn(reference)(otherReference)).toBe(false)
    expect(isnt(reference, sameReference)).toBe(false)
    expect(isnt(reference, otherReference)).toBe(true)
    expect(isntOn(reference)(sameReference)).toBe(false)
    expect(isntOn(reference)(otherReference)).toBe(true)
    expect(isReferenceEquality(reference)).toBe(true)
    expect(isReferenceEquality(() => null)).toBe(true)
    expect(isReferenceEquality('oak')).toBe(false)
    expect(isValueEquality('oak')).toBe(true)
    expect(isValueEquality(reference)).toBe(false)

    expect(patternFor({ name: 'oak' })).toEqual({})
    expect(patternForSchema(Schema.Struct({ name: Schema.String }))).toEqual({})
    expect(patternForV1Schema({ _output: { name: 'oak' } })).toEqual({})
  })

  test('covers equality type guards', () => {
    const maybeNull: string | null = null
    const maybeText: string | null = 'oak'
    const maybeFlag: 'on' | 'off' = 'on'

    expect(isTypeWith(null)(maybeNull)).toBe(true)
    expect(isTypeWith(null)(maybeText)).toBe(false)
    expect(isntTypeWith(null)(maybeNull)).toBe(false)
    expect(isntTypeWith(null)(maybeText)).toBe(true)
    expect(isTypeWith('on')(maybeFlag)).toBe(true)
    expect(isntTypeWith('on')(maybeFlag)).toBe(false)
  })
})
