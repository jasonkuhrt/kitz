import * as MimeType from './mime-type.js'

/**
 * HTTP Accept header name.
 */
export const Accept = `Accept`
/**
 * HTTP Content-Type header name.
 */
export const ContentType = `Content-Type`
/**
 * HTTP Cache-Control header name.
 */
export const CacheControl = `Cache-Control`

/**
 * Create a Content-Type header tuple.
 *
 * @param mimeType - The MIME type value.
 * @returns A tuple of header name and value.
 *
 * @example
 * ```ts
 * const header = contentType(MimeType.applicationJson)
 * // returns ['Content-Type', 'application/json']
 * ```
 */
export const contentType = (mimeType: MimeType.Any) => {
  return [ContentType, mimeType] as [typeof ContentType, MimeType.Any]
}

/**
 * Build a Cache-Control header value for HTTP responses.
 *
 * @param input - Cache control directives.
 * @param input.maxAge - Maximum age in seconds.
 * @param input.sMaxAge - Shared cache maximum age in seconds.
 * @param input.noCache - Disable caching.
 * @param input.noStore - Prevent storage.
 * @param input.noTransform - Prevent transformations.
 * @param input.mustUnderstand - Must understand directive.
 * @param input.mustRevalidate - Must revalidate directive.
 * @param input.proxyRevalidate - Proxy must revalidate.
 * @param input.immutable - Resource is immutable.
 * @param input.visibility - Cache visibility ('public' or 'private').
 * @param input.staleWhileRevalidate - Serve stale while revalidating (seconds).
 * @param input.staleIfError - Serve stale on error (seconds).
 * @returns A tuple of header name and formatted value.
 *
 * @example
 * ```ts
 * const header = responseCacheControl({
 *   maxAge: 3600,
 *   visibility: 'public',
 *   immutable: true
 * })
 * // returns ['Cache-Control', 'public, max-age=3600, immutable']
 * ```
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control
 */
export const responseCacheControl = (input: {
  maxAge?: number
  sMaxAge?: number
  noCache?: boolean
  noStore?: boolean
  noTransform?: boolean
  mustUnderstand?: boolean
  mustRevalidate?: boolean
  proxyRevalidate?: boolean
  immutable?: boolean
  visibility?: `public` | `private`
  staleWhileRevalidate?: number
  staleIfError?: number
}) => {
  const maxAge = input.maxAge ? `max-age=${input.maxAge}` : ``
  const immutable = input.immutable ? `immutable` : ``
  const sMaxAge = input.sMaxAge ? `s-maxage=${input.sMaxAge}` : ``
  const visibility = input.visibility ?? ``
  const staleWhileRevalidate = input.staleWhileRevalidate
    ? `stale-while-revalidate=${input.staleWhileRevalidate}`
    : ``
  const staleIfError = input.staleIfError ? `stale-if-error=${input.staleIfError}` : ``
  const noCache = input.noCache ? `no-cache` : ``
  const noStore = input.noStore ? `no-store` : ``
  const noTransform = input.noTransform ? `no-transform` : ``
  const mustUnderstand = input.mustUnderstand ? `must-understand` : ``
  const mustRevalidate = input.mustRevalidate ? `must-revalidate` : ``
  const proxyRevalidate = input.proxyRevalidate ? `proxy-revalidate` : ``
  const parts = [
    visibility,
    maxAge,
    immutable,
    sMaxAge,
    staleWhileRevalidate,
    staleIfError,
    noCache,
    noStore,
    noTransform,
    mustUnderstand,
    mustRevalidate,
    proxyRevalidate,
  ]
  const value = parts.filter(Boolean).join(`, `)
  return [CacheControl, value] as [typeof CacheControl, string]
}

/**
 * Headers input type - either a Headers instance, array of tuples, or object.
 */
export type HeadersInput = Headers | [string, string][] | Record<string, string>

/**
 * Convert HeadersInit to a plain object.
 * Handles Headers instances, arrays, and plain objects.
 *
 * @param headers - Headers in any format (Headers, array of tuples, or object)
 * @returns Plain object with header names and values
 * @example
 * ```ts
 * // From Headers instance
 * const headers = new Headers({ 'Content-Type': 'application/json' })
 * HeadersInitToPlainObject(headers)  // { 'content-type': 'application/json' }
 *
 * // From array
 * HeadersInitToPlainObject([['Content-Type', 'text/html']])  // { 'content-type': 'text/html' }
 *
 * // From object
 * HeadersInitToPlainObject({ 'X-Custom': 'value' })  // { 'x-custom': 'value' }
 * ```
 */
export const initToRec = (headers?: HeadersInput): Record<string, string> => {
  if (!headers) return {}

  if (headers instanceof Headers) {
    return toRec(headers)
  }

  if (Array.isArray(headers)) {
    const result: Record<string, string> = {}
    for (const [key, value] of headers) {
      result[key.toLowerCase()] = value
    }
    return result
  }

  // Plain object
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = String(value)
  }
  return result
}

/**
 * Convert a Headers instance to a plain object.
 *
 * @param headers - Headers instance (e.g., from Response)
 * @returns Plain object with header names and values
 * @example
 * ```ts
 * const response = await fetch('https://example.com')
 * const headers = HeadersInstanceToPlainObject(response.headers)
 * // { 'content-type': 'text/html', ... }
 * ```
 */
export const toRec = (headers: Headers): Record<string, string> => {
  const result: Record<string, string> = {}

  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value
  })

  return result
}

export const mergeInitWithStrategySet = (
  baseHeaders?: HeadersInit,
  additionalHeaders?: HeadersInit,
) => {
  const base = new Headers(baseHeaders)
  const additional = new Headers(additionalHeaders)
  for (const [key, value] of additional) {
    if (value === UnsetValue) {
      base.delete(key)
    } else {
      base.set(key, value) // todo append instead of set?
    }
  }
  return base
}

export const UnsetValue = ``

/**
 * Merges two sets of headers, with the second set taking precedence for duplicate keys
 */
export function mergeInitWithStrategyMerge(
  base?: HeadersInit,
  additional?: HeadersInit,
): Headers | undefined {
  if (!additional) return base instanceof Headers ? base : base ? new Headers(base) : undefined
  if (!base) return new Headers(additional)

  const base_ = new Headers(base)
  const additional_ = new Headers(additional)

  for (const [key, value] of additional_) {
    if (value === UnsetValue) {
      base_.delete(key)
    } else {
      base_.append(key, value)
    }
  }

  return base_
}
