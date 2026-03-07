/**
 * Informational responses (100–199)
 * Indicates a provisional response, consisting of the Status-Line and optional headers,
 * and is terminated by an empty line.
 */

import type { Status } from './type.js'

/**
 * The server has received the request headers and the client should proceed to send the request body.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/100
 */
export const Continue = { code: 100 as const, description: `Continue` } satisfies Status

/**
 * The server is switching protocols as requested by the client.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/101
 */
export const SwitchingProtocols = {
  code: 101 as const,
  description: `Switching Protocols`,
} satisfies Status

/**
 * The server has received and is processing the request, but no response is available yet.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/102
 */
export const Processing = { code: 102 as const, description: `Processing` } satisfies Status

/**
 * Intended to be used with the Link header, allowing the user agent to start preloading
 * resources while the server prepares a response.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/103
 */
export const EarlyHints = { code: 103 as const, description: `Early Hints` } satisfies Status
