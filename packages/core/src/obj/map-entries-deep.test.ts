import { Test } from '#kitz/test'
import { Obj } from '#obj'

const stripDollarPrefix = (key: string, value: Obj.DeepObjectValue) =>
  key.startsWith('$') ? { key: key.slice(1), value } : undefined

const uppercaseStrings = (key: string, value: Obj.DeepObjectValue) =>
  typeof value === 'string' ? { key, value: value.toUpperCase() } : undefined

const uppercaseKeysTransform = (key: string, value: Obj.DeepObjectValue) => ({ key: key.toUpperCase(), value })

const selectiveTransform = (key: string, value: Obj.DeepObjectValue) =>
  key === 'transform' ? { key, value: 'TRANSFORMED' } : undefined

const combinedTransform = (key: string, value: Obj.DeepObjectValue) => {
  if (key.startsWith('$')) {
    return { key: key.slice(1), value: typeof value === 'string' ? value.toUpperCase() : value }
  }
  return undefined
}

Test.on(Obj.mapEntriesDeep)
  .describeInputs('primitives', [
    ['hello', () => undefined],
    [42, () => undefined],
    [true, () => undefined],
    [null, () => undefined],
  ])
  .describeInputs('empty objects', [
    [{}, uppercaseKeysTransform],
  ])
  .describeInputs('key transformations', [
    [{ $foo: 'bar', $baz: { $nested: 'value' } }, stripDollarPrefix],
    [{ $a: { $b: { $c: { $d: 'deep' } } } }, stripDollarPrefix],
    [{ $foo: 'a', bar: 'b', $baz: { nested: 'c' } }, stripDollarPrefix],
  ])
  .describeInputs('value transformations', [
    [{ name: 'alice', address: { city: 'nyc' } }, uppercaseStrings],
    [{ str: 'hi', num: 42, bool: true, nil: null }, uppercaseStrings],
  ])
  .describeInputs('arrays', [
    [{ users: [{ $id: 1, $name: 'alice' }, { $id: 2, $name: 'bob' }] }, stripDollarPrefix],
    [{ numbers: [1, 2, 3], strings: ['a', 'b'] }, () => undefined],
  ])
  .describeInputs('mixed structures', [
    [{ str: 'hello', arr: [1, 'two', { nested: 'obj' }], obj: { inner: 'value' } }, uppercaseStrings],
  ])
  .describeInputs('selective transformations', [
    [{ keep: 'me', transform: 'this' }, selectiveTransform],
  ])
  .describeInputs('combined transformations', [
    [{ $name: 'alice', age: 25, $email: 'alice@example.com' }, combinedTransform],
  ])
  .describeInputs('non-plain objects (Date, RegExp, etc.)', [
    [{ $pattern: /test/i as any }, stripDollarPrefix],
    [{ nested: { $regex: /[a-z]+/ as any } }, stripDollarPrefix],
  ])
  .test()
