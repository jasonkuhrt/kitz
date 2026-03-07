/**
 * A factory function that creates URL instances from paths.
 * @param path - The path to append to the base URL
 * @returns A new URL instance
 */
export type Factory = (path: string) => URL

/**
 * Creates a URL factory with a base URL.
 * The factory can then create new URLs by appending paths to the base.
 * @param baseUrl - The base URL to use for all created URLs
 * @returns A factory function that creates URLs relative to the base
 * @example
 * ```ts
 * const createApiUrl = factory(new URL('https://api.example.com/'))
 * const usersUrl = createApiUrl('users') // https://api.example.com/users
 * const userUrl = createApiUrl('users/123') // https://api.example.com/users/123
 *
 * const createLocalUrl = factory(new URL('http://localhost:3000/'))
 * const apiUrl = createLocalUrl('api/v1') // http://localhost:3000/api/v1
 * ```
 */
export const factory = (baseUrl: URL): Factory => {
  return (path) => {
    return new URL(path, baseUrl)
  }
}

/**
 * The standard URL path separator character.
 * @default '/'
 */
export const pathSeparator = '/'

/**
 * Parse a URL string without throwing errors.
 * Returns either a URL instance or an Error if parsing fails.
 *
 * @param url - The URL string to parse
 * @returns A URL instance if successful, or an Error if parsing fails
 * @example
 * ```ts
 * const result1 = Url.parse('https://example.com')
 * // result1 is URL instance
 *
 * const result2 = Url.parse('not a valid url')
 * // result2 is Error instance
 *
 * if (result instanceof Error) {
 *   console.error('Invalid URL:', result.message)
 * } else {
 *   console.log('Parsed URL:', result.href)
 * }
 * ```
 */
export const parse = (url: string): URL | Error => {
  if (!URL.canParse(url)) {
    return new Error(`Invalid URL: ${url}`)
  }
  return new URL(url)
}

// export const fileURLToPath
