/**
 * Represents an HTTP status code and its description.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
 */
export interface Status {
  /** The HTTP status code (e.g., 200, 404, 500) */
  code: number
  /** Human-readable description of the status code */
  description: string
}

import type * as StatusesInformational from './1xx-informational.js'
import type * as StatusesSuccessful from './2xx-successful.js'
import type * as StatusesRedirection from './3xx-redirection.js'
import type * as StatusesClientError from './4xx-client-error.js'
import type * as StatusesServerError from './5xx-server-error.js'

export namespace Code {
  export type Informational =
    (typeof StatusesInformational)[keyof typeof StatusesInformational]['code']
  export type Successful = (typeof StatusesSuccessful)[keyof typeof StatusesSuccessful]['code']
  export type Redirection = (typeof StatusesRedirection)[keyof typeof StatusesRedirection]['code']
  export type ClientError = (typeof StatusesClientError)[keyof typeof StatusesClientError]['code']
  export type ServerError = (typeof StatusesServerError)[keyof typeof StatusesServerError]['code']
  export type All = Informational | Successful | Redirection | ClientError | ServerError
}
