import { beforeEach, describe, expect, test } from 'bun:test'
import { Builder } from './builder.js'

let builder: Builder

beforeEach(() => {
  builder = Builder()
})

describe(`template literal usage`, () => {
  test(`empty adds newline to code`, () => {
    builder`a````b`
    expect(builder.toString()).toBe(`a\n\nb`)
  })

  test(`interpolates values correctly`, () => {
    const typeName = 'Query'
    const kind = 'OBJECT'
    builder`  '${typeName}': { kind: '${kind}'; name: '${typeName}'; }`
    expect(builder.toString()).toBe(`'Query': { kind: 'OBJECT'; name: 'Query'; }`)
  })
})

describe(`function usage`, () => {
  test(`empty adds newline to code`, () => {
    builder(`a`)(``)(`b`)
    expect(builder.toString()).toBe(`a\n\nb`)
    const builder2 = Builder()(`a`)()(`b`)
    expect(builder2.toString()).toEqual(builder.toString())
  })
})
