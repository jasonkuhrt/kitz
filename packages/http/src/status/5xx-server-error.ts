/**
 * Server error responses (500–599)
 * Indicates cases in which the server is aware that it has encountered an error or is otherwise incapable of performing the request.
 */

import type { Status } from './type.js'

/**
 * The server has encountered a situation it doesn't know how to handle.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500
 */
export const InternalServerError = {
  code: 500 as const,
  description: `Internal Server Error`,
} satisfies Status

/**
 * The request method is not supported by the server and cannot be handled.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/501
 */
export const NotImplemented = {
  code: 501 as const,
  description: `Not Implemented`,
} satisfies Status

/**
 * This error response means that the server, while working as a gateway to get a response needed to handle the request,
 * got an invalid response.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/502
 */
export const BadGateway = { code: 502 as const, description: `Bad Gateway` } satisfies Status

/**
 * The server is not ready to handle the request. Common causes are a server that is down for maintenance or that is overloaded.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503
 */
export const ServiceUnavailable = {
  code: 503 as const,
  description: `Service Unavailable`,
} satisfies Status

/**
 * This error response is given when the server is acting as a gateway and cannot get a response in time.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504
 */
export const GatewayTimeout = {
  code: 504 as const,
  description: `Gateway Timeout`,
} satisfies Status

/**
 * The HTTP version used in the request is not supported by the server.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/505
 */
export const HTTPVersionNotSupported = {
  code: 505 as const,
  description: `HTTP Version Not Supported`,
} satisfies Status

/**
 * The server has an internal configuration error: the chosen variant resource is configured to engage in
 * transparent content negotiation itself, and is therefore not a proper end point in the negotiation process.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/506
 */
export const VariantAlsoNegotiates = {
  code: 506 as const,
  description: `Variant Also Negotiates`,
} satisfies Status

/**
 * The method could not be performed on the resource because the server is unable to store the representation needed to successfully complete the request.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/507
 */
export const InsufficientStorage = {
  code: 507 as const,
  description: `Insufficient Storage`,
} satisfies Status

/**
 * The server detected an infinite loop while processing the request.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/508
 */
export const LoopDetected = { code: 508 as const, description: `Loop Detected` } satisfies Status

/**
 * Further extensions to the request are required for the server to fulfill it.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/510
 */
export const NotExtended = { code: 510 as const, description: `Not Extended` } satisfies Status

/**
 * The client needs to authenticate to gain network access.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/511
 */
export const NetworkAuthenticationRequired = {
  code: 511 as const,
  description: `Network Authentication Required`,
} satisfies Status
