import { test } from 'bun:test'

test('allows throw in tests', () => {
  throw new Error('expected throw in test boundary')
})
