import { describe, expect, test } from 'vitest'
import * as HttpModule from './_.js'
import {
  Accept,
  CacheControl,
  ContentType,
  UnsetValue,
  contentType,
  initToRec,
  mergeInitWithStrategyMerge,
  mergeInitWithStrategySet,
  responseCacheControl,
  toRec,
} from './headers.js'
import * as Method from './method.js'
import * as MimeType from './mime-type.js'
import { mergeInit } from './req.js'
import { internalServerError, notFound } from './response.js'
import { appendAll, appendAllMutate, appendAllToPath } from './search-params.js'
import * as Status from './status/_.js'

describe('http', () => {
  test('exports namespaces, methods, mime types, and statuses', async () => {
    expect(HttpModule.Http.Headers.Accept).toBe(Accept)
    expect(HttpModule.Http.Method.get).toBe(Method.get)
    expect(HttpModule.Http.MimeType.applicationJson).toBe(MimeType.applicationJson)
    expect(HttpModule.Http.Status.OK.code).toBe(200)
    expect(HttpModule.Http.Status.NotFound.description).toBe('Not Found')
    expect(Status.Status.Continue.code).toBe(100)
    expect(Status.Status.MovedPermanently.code).toBe(301)
    expect(Status.Status.TooManyRequests.code).toBe(429)
    expect(Status.Status.NetworkAuthenticationRequired.code).toBe(511)
    expect(Method.delete).toBe('delete')
    expect(Method.trace).toBe('trace')
    expect(MimeType.applicationGraphqlResponse).toBe(MimeType.applicationGraphqlResponseJson)
    expect(MimeType.applicationFormMultipart).toBe(MimeType.multipartFormData)
    expect(await notFound.text()).toBe('Not Found')
    expect(notFound.status).toBe(404)
  })

  test('builds and normalizes headers', () => {
    const cacheHeader = responseCacheControl({
      maxAge: 3600,
      sMaxAge: 7200,
      immutable: true,
      visibility: 'public',
      staleWhileRevalidate: 30,
      staleIfError: 60,
      noCache: true,
      noStore: true,
      noTransform: true,
      mustUnderstand: true,
      mustRevalidate: true,
      proxyRevalidate: true,
    })
    const headers = new Headers({ 'Content-Type': 'application/json', 'X-Test': 'yes' })

    expect(ContentType).toBe('Content-Type')
    expect(CacheControl).toBe('Cache-Control')
    expect(contentType(MimeType.applicationJson)).toEqual(['Content-Type', 'application/json'])
    expect(cacheHeader).toEqual([
      'Cache-Control',
      'public, max-age=3600, immutable, s-maxage=7200, stale-while-revalidate=30, stale-if-error=60, no-cache, no-store, no-transform, must-understand, must-revalidate, proxy-revalidate',
    ])
    expect(initToRec()).toEqual({})
    expect(initToRec(headers)).toEqual({
      'content-type': 'application/json',
      'x-test': 'yes',
    })
    expect(initToRec([['X-Array', '1']])).toEqual({ 'x-array': '1' })
    expect(initToRec({ 'X-Obj': '2' })).toEqual({ 'x-obj': '2' })
    expect(toRec(headers)).toEqual({
      'content-type': 'application/json',
      'x-test': 'yes',
    })
  })

  test('merges headers and request init structures', () => {
    const mergedSet = mergeInitWithStrategySet(
      { 'x-base': '1', 'x-drop': 'keep' },
      { 'x-add': '2', 'x-drop': UnsetValue },
    )
    const mergedAppend = mergeInitWithStrategyMerge(
      { 'x-list': 'a=1', 'x-drop': 'keep' },
      { 'x-list': 'b=2', 'x-drop': UnsetValue },
    )
    const fromAdditionalOnly = mergeInitWithStrategyMerge(undefined, { 'x-only': '1' })
    const fromBaseOnly = mergeInitWithStrategyMerge({ 'x-only': '1' }, undefined)
    const request = mergeInit(
      { method: 'GET', headers: { 'x-base': '1', 'x-drop': 'keep' } },
      { method: 'POST', headers: { 'x-add': '2', 'x-drop': UnsetValue } },
    )

    expect(initToRec(mergedSet)).toEqual({ 'x-add': '2', 'x-base': '1' })
    expect(initToRec(mergedAppend)).toEqual({ 'x-list': 'a=1, b=2' })
    expect(initToRec(fromAdditionalOnly)).toEqual({ 'x-only': '1' })
    expect(initToRec(fromBaseOnly)).toEqual({ 'x-only': '1' })
    expect(request.method).toBe('POST')
    expect(initToRec(request.headers)).toEqual({ 'x-add': '2', 'x-base': '1' })
  })

  test('creates response helpers and search-param utilities', () => {
    const url = new URL('https://example.com/path?existing=yes')
    appendAllMutate(url, { next: '1', extra: '2' })
    const appended = appendAll('https://example.com/root', { a: '1', b: '2' })
    const pathWithParams = appendAllToPath('/docs?page=1', { q: 'test', page: '2' })
    const errorResponse = internalServerError()

    expect(url.toString()).toBe('https://example.com/path?existing=yes&next=1&extra=2')
    expect(appended.toString()).toBe('https://example.com/root?a=1&b=2')
    expect(pathWithParams).toBe('/docs?page=1&q=test&page=2')
    expect(errorResponse.status).toBe(500)
    expect(errorResponse.statusText).toBe('Internal Server Error')
  })
})
