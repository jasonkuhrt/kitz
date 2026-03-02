import { Schema } from 'effect'
import { describe, expect, test } from 'vitest'
import {
  ExecutorError,
  ExecutorGHReleaseError,
  ExecutorPreflightError,
  ExecutorPublishError,
  ExecutorTagError,
} from './errors.js'

describe('ExecutorPublishError', () => {
  test('constructs with message', () => {
    const err = new ExecutorPublishError({
      context: { packageName: '@kitz/core', detail: 'npm 403' },
    })
    expect(err._tag).toBe('ExecutorPublishError')
    expect(err.message).toContain('@kitz/core')
    expect(err.message).toContain('npm 403')
  })
})

describe('ExecutorTagError', () => {
  test('constructs with message', () => {
    const err = new ExecutorTagError({
      context: { tag: '@kitz/core@1.0.0', detail: 'tag already exists' },
    })
    expect(err._tag).toBe('ExecutorTagError')
    expect(err.message).toContain('@kitz/core@1.0.0')
  })
})

describe('ExecutorPreflightError', () => {
  test('constructs with message', () => {
    const err = new ExecutorPreflightError({
      context: { check: 'env.npm-authenticated', detail: 'not logged in' },
    })
    expect(err._tag).toBe('ExecutorPreflightError')
    expect(err.message).toContain('env.npm-authenticated')
  })
})

describe('ExecutorGHReleaseError', () => {
  test('constructs with message', () => {
    const err = new ExecutorGHReleaseError({
      context: { tag: '@kitz/core@1.0.0', detail: 'API rate limit' },
    })
    expect(err._tag).toBe('ExecutorGHReleaseError')
    expect(err.message).toContain('GitHub release')
    expect(err.message).toContain('@kitz/core@1.0.0')
  })
})

describe('ExecutorError union', () => {
  test('all variants are valid', () => {
    const errors = [
      new ExecutorPublishError({ context: { packageName: 'pkg', detail: 'd' } }),
      new ExecutorTagError({ context: { tag: 'tag', detail: 'd' } }),
      new ExecutorPreflightError({ context: { check: 'c', detail: 'd' } }),
      new ExecutorGHReleaseError({ context: { tag: 'tag', detail: 'd' } }),
    ]
    for (const err of errors) {
      expect(err).toBeInstanceOf(Error)
    }
  })

  test('schema roundtrip', () => {
    const err = new ExecutorPublishError({ context: { packageName: '@kitz/core', detail: 'test' } })
    const encoded = Schema.encodeSync(ExecutorError)(err)
    const decoded = Schema.decodeSync(ExecutorError)(encoded)
    expect(decoded._tag).toBe('ExecutorPublishError')
  })
})
