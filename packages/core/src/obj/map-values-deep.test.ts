import { Test } from '#kitz/test'
import { Obj } from '#obj'

// Test visitors
const errorToMessage = (value: any) => {
  if (value instanceof Error) return value.message
}

const truncateLongStrings = (value: any) => {
  if (typeof value === 'string' && value.length > 10) {
    return value.slice(0, 10) + '...'
  }
}

const doubleNumbers = (value: any) => {
  if (typeof value === 'number') return value * 2
}

const replaceSpecificObject = (value: any) => {
  if (typeof value === 'object' && value !== null && 'replace' in value) {
    return 'REPLACED'
  }
}

Test.on(Obj.mapValuesDeep)
  .describeInputs('primitives pass through', [
    ['hello', () => undefined],
    [42, () => undefined],
    [true, () => undefined],
    [null, () => undefined],
    [undefined, () => undefined],
  ])
  .describeInputs('early exit on match', [
    [new Error('test error'), errorToMessage],
    ['short', truncateLongStrings],
    ['this is a very long string', truncateLongStrings],
    [5, doubleNumbers],
    [{ num: 10, nested: { num: 20 } }, doubleNumbers],
  ])
  .describeInputs('array recursion', [
    [[1, 2, 3], doubleNumbers],
    [[new Error('e1'), new Error('e2')], errorToMessage],
    [['short', 'this is long'], truncateLongStrings],
  ])
  .describeInputs('object recursion', [
    [{ a: 5, b: { c: 10 } }, doubleNumbers],
    [{ err: new Error('test') }, errorToMessage],
    [{ str: 'short and long string' }, truncateLongStrings],
  ])
  .describeInputs('mixed structures', [
    [{ nums: [1, 2], nested: { nums: [3, 4] } }, doubleNumbers],
  ])
  .describeInputs('early exit stops recursion', [
    [{ replace: true, nested: { untouched: 'data' } }, replaceSpecificObject],
  ])
  .test()
