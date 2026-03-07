/**
 * Redirection messages (300–399)
 * Indicates that further action needs to be taken by the user agent to fulfill the request.
 */

import type { Status } from './type.js'

/**
 * The request has more than one possible response. The user agent or user should choose one of them.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/300
 */
export const MultipleChoices = {
  code: 300 as const,
  description: `Multiple Choices`,
} satisfies Status

/**
 * The URL of the requested resource has been changed permanently. The new URL is given in the response.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/301
 */
export const MovedPermanently = {
  code: 301 as const,
  description: `Moved Permanently`,
} satisfies Status

/**
 * This response code means that the URI of requested resource has been changed temporarily.
 * Further changes in the URI might be made in the future.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302
 */
export const Found = { code: 302 as const, description: `Found` } satisfies Status

/**
 * The server sent this response to direct the client to get the requested resource at another URI with a GET request.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
 */
export const SeeOther = { code: 303 as const, description: `See Other` } satisfies Status

/**
 * This is used for caching purposes. It tells the client that the response has not been modified,
 * so the client can continue to use the same cached version of the response.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/304
 */
export const NotModified = { code: 304 as const, description: `Not Modified` } satisfies Status

/**
 * Defined in a previous version of the HTTP specification to indicate that a requested response must be accessed by a proxy.
 * @deprecated Due to security concerns, this status code is deprecated.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/305
 */
export const UseProxy = { code: 305 as const, description: `Use Proxy` } satisfies Status

/**
 * No longer used. This code is reserved for future use.
 * @deprecated
 */
export const SwitchProxy = { code: 306 as const, description: `Switch Proxy` } satisfies Status

/**
 * The server sends this response to direct the client to get the requested resource at another URI
 * with same method that was used in the prior request. This has the same semantics as the 302 Found HTTP response code.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
 */
export const TemporaryRedirect = {
  code: 307 as const,
  description: `Temporary Redirect`,
} satisfies Status

/**
 * This means that the resource is now permanently located at another URI, specified by the Location: HTTP Response header.
 * This has the same semantics as the 301 Moved Permanently HTTP response code.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/308
 */
export const PermanentRedirect = {
  code: 308 as const,
  description: `Permanent Redirect`,
} satisfies Status
