/**
 * Successful responses (200–299)
 * Indicates that the client's request was successfully received, understood, and accepted.
 */

import type { Status } from './type.js'

/**
 * The request has succeeded.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/200
 */
export const OK = { code: 200 as const, description: `OK` } satisfies Status

/**
 * The request has been fulfilled and resulted in a new resource being created.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/201
 */
export const Created = { code: 201 as const, description: `Created` } satisfies Status

/**
 * The request has been accepted for processing, but the processing has not been completed.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/202
 */
export const Accepted = { code: 202 as const, description: `Accepted` } satisfies Status

/**
 * The server successfully processed the request, but is returning information that may be from another source.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/203
 */
export const NonAuthoritativeInformation = {
  code: 203 as const,
  description: `Non-Authoritative Information`,
} satisfies Status

/**
 * The server successfully processed the request, but is not returning any content.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/204
 */
export const NoContent = { code: 204 as const, description: `No Content` } satisfies Status

/**
 * The server successfully processed the request, but is not returning any content. Unlike a 204 response,
 * this response requires that the requester reset the document view.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/205
 */
export const ResetContent = { code: 205 as const, description: `Reset Content` } satisfies Status

/**
 * The server is delivering only part of the resource due to a range header sent by the client.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206
 */
export const PartialContent = {
  code: 206 as const,
  description: `Partial Content`,
} satisfies Status

/**
 * The message body that follows is an XML message and can contain a number of separate response codes,
 * depending on how many sub-requests were made.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/207
 */
export const MultiStatus = { code: 207 as const, description: `Multi-Status` } satisfies Status

/**
 * The members of a DAV binding have already been enumerated in a previous reply to this request,
 * and are not being included again.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/208
 */
export const AlreadyReported = {
  code: 208 as const,
  description: `Already Reported`,
} satisfies Status

/**
 * The server has fulfilled a GET request for the resource, and the response is a representation
 * of the result of one or more instance-manipulations applied to the current instance.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/226
 */
export const IMUsed = { code: 226 as const, description: `IM Used` } satisfies Status
