import { describe, expect, test } from 'vitest'
import * as UrlModule from './_.js'
import { factory, parse, pathSeparator } from './url.js'

describe('url', () => {
  test('exports the Url namespace', () => {
    expect(UrlModule.Url.factory).toBe(factory)
    expect(UrlModule.Url.pathSeparator).toBe(pathSeparator)
  })

  test('creates relative URLs from a base', () => {
    const createApiUrl = factory(new URL('https://example.com/api/'))

    expect(createApiUrl('users/123').href).toBe('https://example.com/api/users/123')
    expect(createApiUrl('/health').href).toBe('https://example.com/health')
    expect(pathSeparator).toBe('/')
  })

  test('parses valid URLs and returns an error for invalid input', () => {
    const valid = parse('https://kitz.dev/docs')
    const invalid = parse('not a url')

    expect(valid).toBeInstanceOf(URL)
    expect(valid instanceof URL && valid.hostname).toBe('kitz.dev')
    expect(invalid).toBeInstanceOf(Error)
    expect(invalid instanceof Error && invalid.message).toContain('Invalid URL')
    expect(invalid instanceof Error && invalid.message).toContain('not a url')
  })
})
