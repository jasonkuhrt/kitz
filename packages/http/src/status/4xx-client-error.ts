/**
 * Client error responses (400–499)
 * Indicates that the client seems to have erred.
 */

import type { Status } from './type.js'

/**
 * The server cannot or will not process the request due to something that is perceived to be a client error.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400
 */
export const BadRequest = { code: 400 as const, description: `Bad Request` } satisfies Status

/**
 * The request has not been applied because it lacks valid authentication credentials for the target resource.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401
 */
export const Unauthorized = { code: 401 as const, description: `Unauthorized` } satisfies Status

/**
 * Reserved for future use. The original intention was that this code might be used as part of some form of digital
 * cash or micropayment scheme, but that has not happened, and this code is not usually used.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402
 */
export const PaymentRequired = {
  code: 402 as const,
  description: `Payment Required`,
} satisfies Status

/**
 * The client does not have access rights to the content; that is, it is unauthorized, so the server is refusing
 * to give the requested resource. Unlike 401, the client's identity is known to the server.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403
 */
export const Forbidden = { code: 403 as const, description: `Forbidden` } satisfies Status

/**
 * The server can not find the requested resource. In the browser, this means the URL is not recognized.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404
 */
export const NotFound = { code: 404 as const, description: `Not Found` } satisfies Status

/**
 * The request method is known by the server but is not supported by the target resource.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405
 */
export const MethodNotAllowed = {
  code: 405 as const,
  description: `Method Not Allowed`,
} satisfies Status

/**
 * The server cannot produce a response matching the list of acceptable values defined in the request's
 * proactive content negotiation headers, and the server is unwilling to supply a default representation.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/406
 */
export const NotAcceptable = { code: 406 as const, description: `Not Acceptable` } satisfies Status

/**
 * This is similar to 401 Unauthorized but authentication is needed to be done by a proxy.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/407
 */
export const ProxyAuthenticationRequired = {
  code: 407 as const,
  description: `Proxy Authentication Required`,
} satisfies Status

/**
 * This response is sent on an idle connection by some servers, even without any previous request by the client.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/408
 */
export const RequestTimeout = {
  code: 408 as const,
  description: `Request Timeout`,
} satisfies Status

/**
 * This response is sent when a request conflicts with the current state of the server.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409
 */
export const Conflict = { code: 409 as const, description: `Conflict` } satisfies Status

/**
 * This response is sent when the requested content has been permanently deleted from server, with no forwarding address.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/410
 */
export const Gone = { code: 410 as const, description: `Gone` } satisfies Status

/**
 * Server rejected the request because the Content-Length header field is not defined and the server requires it.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/411
 */
export const LengthRequired = {
  code: 411 as const,
  description: `Length Required`,
} satisfies Status

/**
 * The client has indicated preconditions in its headers which the server does not meet.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/412
 */
export const PreconditionFailed = {
  code: 412 as const,
  description: `Precondition Failed`,
} satisfies Status

/**
 * Request entity is larger than limits defined by server. The server may close the connection or return a Retry-After header.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413
 */
export const PayloadTooLarge = {
  code: 413 as const,
  description: `Payload Too Large`,
} satisfies Status

/**
 * The URI requested by the client is longer than the server is willing to interpret.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/414
 */
export const URITooLong = { code: 414 as const, description: `URI Too Long` } satisfies Status

/**
 * The media format of the requested data is not supported by the server, so the server is rejecting the request.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/415
 */
export const UnsupportedMediaType = {
  code: 415 as const,
  description: `Unsupported Media Type`,
} satisfies Status

/**
 * The range specified by the Range header field in the request cannot be fulfilled.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416
 */
export const RangeNotSatisfiable = {
  code: 416 as const,
  description: `Range Not Satisfiable`,
} satisfies Status

/**
 * This response code means the expectation indicated by the Expect request header field cannot be met by the server.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/417
 */
export const ExpectationFailed = {
  code: 417 as const,
  description: `Expectation Failed`,
} satisfies Status

/**
 * The server refuses the attempt to brew coffee with a teapot. (RFC 2324)
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/418
 */
export const ImATeapot = { code: 418 as const, description: `I'm a teapot` } satisfies Status

/**
 * The request was directed at a server that is not able to produce a response.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/421
 */
export const MisdirectedRequest = {
  code: 421 as const,
  description: `Misdirected Request`,
} satisfies Status

/**
 * The request was well-formed but was unable to be followed due to semantic errors.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422
 */
export const UnprocessableEntity = {
  code: 422 as const,
  description: `Unprocessable Entity`,
} satisfies Status

/**
 * The resource that is being accessed is locked.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/423
 */
export const Locked = { code: 423 as const, description: `Locked` } satisfies Status

/**
 * The request failed because it depended on another request and that request failed.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/424
 */
export const FailedDependency = {
  code: 424 as const,
  description: `Failed Dependency`,
} satisfies Status

/**
 * Indicates that the server is unwilling to risk processing a request that might be replayed.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/425
 */
export const TooEarly = { code: 425 as const, description: `Too Early` } satisfies Status

/**
 * The server refuses to perform the request using the current protocol but might be willing to do so after
 * the client upgrades to a different protocol.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/426
 */
export const UpgradeRequired = {
  code: 426 as const,
  description: `Upgrade Required`,
} satisfies Status

/**
 * The origin server requires the request to be conditional.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/428
 */
export const PreconditionRequired = {
  code: 428 as const,
  description: `Precondition Required`,
} satisfies Status

/**
 * The user has sent too many requests in a given amount of time ("rate limiting").
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429
 */
export const TooManyRequests = {
  code: 429 as const,
  description: `Too Many Requests`,
} satisfies Status

/**
 * The server is unwilling to process the request because its header fields are too large.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/431
 */
export const RequestHeaderFieldsTooLarge = {
  code: 431 as const,
  description: `Request Header Fields Too Large`,
} satisfies Status

/**
 * The user requests an illegal resource, such as a web page censored by a government.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/451
 */
export const UnavailableForLegalReasons = {
  code: 451 as const,
  description: `Unavailable For Legal Reasons`,
} satisfies Status
