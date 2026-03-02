import { test } from 'vitest'

test('allows throw in tests', () => {
  throw new Error('expected throw in test boundary')
})
