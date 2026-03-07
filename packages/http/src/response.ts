import { Status } from './status/_.js'

/**
 * Pre-configured 404 Not Found response.
 *
 * @example
 * ```ts
 * return Response.notFound
 * // returns a 404 response
 * ```
 */
export const notFound: Response = new Response(Status.NotFound.description, {
  status: Status.NotFound.code,
})

/**
 * Pre-configured 500 Internal Server Error response.
 *
 * @example
 * ```ts
 * return Response.internalServerError
 * // returns a 500 response
 * ```
 */
export const internalServerError = (): Response =>
  new Response(null, {
    status: Status.InternalServerError.code,
    statusText: Status.InternalServerError.description,
  })
