import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import * as ViolationLocation from './violation-location.js'
import { DocLink, Hint, Violation } from './violation.js'

describe('Violation', () => {
  test('make with PrTitle location', () => {
    const v = Violation.make({
      location: ViolationLocation.PrTitle.make({ title: 'bad title' }),
    })
    expect(v._tag).toBe('Violation')
    expect(Violation.is(v)).toBe(true)
    expect(v.location._tag).toBe('ViolationLocationPrTitle')
  })

  test('make with Environment location', () => {
    const v = Violation.make({
      location: ViolationLocation.Environment.make({ message: 'not authenticated' }),
    })
    expect(v.location._tag).toBe('ViolationLocationEnvironment')
  })

  test('schema roundtrip', () => {
    const v = Violation.make({
      location: ViolationLocation.GitHistory.make({ sha: 'abc1234' }),
      summary: 'History is not monotonic',
      hints: [Hint.make({ description: 'Rebase onto trunk before retrying.' })],
      docs: [DocLink.make({ label: 'Release docs', url: 'https://example.com/release' })],
    })
    const encoded = Schema.encodeSync(Violation)(v)
    const decoded = Schema.decodeSync(Violation)(encoded)
    expect(decoded._tag).toBe('Violation')
    expect(decoded.location._tag).toBe('ViolationLocationGitHistory')
    expect(decoded.summary).toBe('History is not monotonic')
    expect(decoded.hints).toHaveLength(1)
    expect(decoded.docs).toHaveLength(1)
  })
})

describe('Hint', () => {
  test('make and is()', () => {
    const h = Hint.make({ description: 'Try running npm login' })
    expect(h._tag).toBe('Hint')
    expect(Hint.is(h)).toBe(true)
    expect(h.description).toBe('Try running npm login')
  })

  test('schema roundtrip', () => {
    const h = Hint.make({ description: 'Consider adding a scope' })
    const encoded = Schema.encodeSync(Hint)(h)
    const decoded = Schema.decodeSync(Hint)(encoded)
    expect(decoded.description).toBe('Consider adding a scope')
  })
})

describe('DocLink', () => {
  test('make and is()', () => {
    const doc = DocLink.make({ label: 'npm docs', url: 'https://docs.npmjs.com/' })
    expect(doc._tag).toBe('ViolationDocLink')
    expect(DocLink.is(doc)).toBe(true)
  })
})

describe('ViolationLocation variants', () => {
  test('PrTitle', () => {
    const loc = ViolationLocation.PrTitle.make({ title: 'fix: something' })
    expect(loc._tag).toBe('ViolationLocationPrTitle')
    expect(ViolationLocation.PrTitle.is(loc)).toBe(true)
  })

  test('PrBody', () => {
    const loc = ViolationLocation.PrBody.make({})
    expect(loc._tag).toBe('ViolationLocationPrBody')
  })

  test('PrBody with line', () => {
    const loc = ViolationLocation.PrBody.make({ line: 42 })
    expect(loc.line).toBe(42)
  })

  test('RepoSettings', () => {
    const loc = ViolationLocation.RepoSettings.make({})
    expect(loc._tag).toBe('ViolationLocationRepoSettings')
  })

  test('GitHistory', () => {
    const loc = ViolationLocation.GitHistory.make({ sha: 'abc1234' })
    expect(loc._tag).toBe('ViolationLocationGitHistory')
    expect(loc.sha).toBe('abc1234')
  })

  test('File', () => {
    const loc = ViolationLocation.File.make({ path: 'src/index.ts', line: 10 })
    expect(loc._tag).toBe('ViolationLocationFile')
    expect(loc.path).toBe('src/index.ts')
    expect(loc.line).toBe(10)
  })

  test('Environment', () => {
    const loc = ViolationLocation.Environment.make({ message: 'npm not authenticated' })
    expect(loc._tag).toBe('ViolationLocationEnvironment')
    expect(loc.message).toBe('npm not authenticated')
  })

  test('ViolationLocation union schema roundtrip', () => {
    const loc = ViolationLocation.File.make({ path: 'test.ts' })
    const encoded = Schema.encodeSync(ViolationLocation.ViolationLocation)(loc)
    const decoded = Schema.decodeSync(ViolationLocation.ViolationLocation)(encoded)
    expect(decoded._tag).toBe('ViolationLocationFile')
  })
})
