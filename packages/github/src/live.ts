import {
  FetchHttpClient,
  Headers,
  HttpBody,
  HttpClient,
  HttpClientError,
  HttpClientResponse,
} from '@effect/platform'
import { Context, Effect, Layer, Option } from 'effect'
import { getGithubToken } from './env.js'
import {
  Github,
  GithubAuthError,
  GithubError,
  GithubNotFoundError,
  type GithubOperation,
  GithubRateLimitError,
  type GithubService,
  type PullRequest,
  type Release,
  type UpdatePullRequestParams,
} from './service.js'

type HttpClientService = Context.Tag.Service<typeof HttpClient.HttpClient>
type GithubLiveLayer = (config: GithubConfig) => Layer.Layer<Github, never, HttpClient.HttpClient>
type GithubLiveFetchLayer = (config: GithubConfig) => Layer.Layer<Github>

// ============================================================================
// Config
// ============================================================================

/**
 * Configuration for the GitHub Live layer.
 */
export interface GithubConfig {
  /** Repository owner (user or organization) */
  readonly owner: string
  /** Repository name */
  readonly repo: string
  /** GitHub token (falls back to GITHUB_TOKEN env) */
  readonly token?: string
}

// ============================================================================
// Helpers
// ============================================================================

const BASE_URL = 'https://api.github.com'

const defaultRateLimitReset = (): Date => {
  const resetAt = new Date()
  resetAt.setTime(resetAt.getTime() + 60000)
  return resetAt
}

/**
 * Parse rate limit reset time from response headers.
 */
const parseRateLimitReset = (headers: Headers.Headers): Date => {
  const resetHeader = Headers.get(headers, 'x-ratelimit-reset')
  if (Option.isSome(resetHeader)) {
    const resetSeconds = parseInt(resetHeader.value, 10)
    if (!isNaN(resetSeconds)) {
      return new Date(resetSeconds * 1000)
    }
  }
  return defaultRateLimitReset()
}

/**
 * Check if a response indicates rate limiting.
 */
const isRateLimited = (response: HttpClientResponse.HttpClientResponse): boolean => {
  if (response.status !== 403) return false
  const remaining = Headers.get(response.headers, 'x-ratelimit-remaining')
  return Option.isSome(remaining) && remaining.value === '0'
}

type GithubApiError = GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError

/**
 * Map HTTP response error to typed GitHub error.
 */
const mapResponseError = (
  operation: GithubOperation,
  resource: string,
  error: HttpClientError.ResponseError,
): GithubApiError => {
  const { status, headers } = error.response

  if (status === 401) {
    return new GithubAuthError({ context: { operation } })
  }

  if (isRateLimited(error.response)) {
    return new GithubRateLimitError({
      context: { operation, resetAt: parseRateLimitReset(headers) },
    })
  }

  if (status === 404) {
    return new GithubNotFoundError({ context: { operation, resource } })
  }

  return new GithubError({
    context: { operation, status, detail: `HTTP ${status}` },
    cause: error,
  })
}

/**
 * Map HTTP request error to typed GitHub error.
 */
const mapRequestError = (
  operation: GithubOperation,
  error: HttpClientError.RequestError,
): GithubError =>
  new GithubError({
    context: { operation, detail: error.message },
    cause: error,
  })

type GithubPostError = GithubError | GithubAuthError | GithubRateLimitError

/**
 * Map HTTP response error to typed GitHub error (for POST requests).
 * Maps 404 to GithubError instead of GithubNotFoundError.
 */
const mapPostResponseError = (
  operation: GithubOperation,
  resource: string,
  error: HttpClientError.ResponseError,
): GithubPostError => {
  const { status, headers } = error.response

  if (status === 401) {
    return new GithubAuthError({ context: { operation } })
  }

  if (isRateLimited(error.response)) {
    return new GithubRateLimitError({
      context: { operation, resetAt: parseRateLimitReset(headers) },
    })
  }

  return new GithubError({
    context: { operation, status, detail: `HTTP ${status}` },
    cause: error,
  })
}

// ============================================================================
// HTTP Request Builders
// ============================================================================

const makeAuthHeaders = (token: string | undefined): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

const jsonBody = (data: unknown): HttpBody.HttpBody => {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(JSON.stringify(data))
  return HttpBody.uint8Array(bytes, 'application/json')
}

// ============================================================================
// Service Implementation
// ============================================================================

const makeGithubService = (
  client: HttpClientService,
  config: GithubConfig,
  token: string | undefined,
): GithubService => {
  const { owner, repo } = config
  const releasesPath = `/repos/${owner}/${repo}/releases`
  const pullsPath = `/repos/${owner}/${repo}/pulls`
  const headers = makeAuthHeaders(token)
  const encodeTag = (tag: string): string => encodeURIComponent(tag)

  const httpGet = <$data>(
    path: string,
    operation: GithubOperation,
  ): Effect.Effect<$data, GithubApiError> =>
    client.get(`${BASE_URL}${path}`, { headers }).pipe(
      Effect.flatMap((response: HttpClientResponse.HttpClientResponse) =>
        HttpClientResponse.filterStatusOk(response),
      ),
      Effect.flatMap(
        (response) => response.json as Effect.Effect<$data, HttpClientError.ResponseError>,
      ),
      Effect.mapError((error: HttpClientError.HttpClientError) =>
        error._tag === 'ResponseError'
          ? mapResponseError(operation, path, error)
          : mapRequestError(operation, error as HttpClientError.RequestError),
      ),
    )

  const httpPost = <$data>(
    path: string,
    data: unknown,
    operation: GithubOperation,
  ): Effect.Effect<$data, GithubPostError> =>
    client.post(`${BASE_URL}${path}`, { headers, body: jsonBody(data) }).pipe(
      Effect.flatMap((response: HttpClientResponse.HttpClientResponse) =>
        HttpClientResponse.filterStatusOk(response),
      ),
      Effect.flatMap(
        (response) => response.json as Effect.Effect<$data, HttpClientError.ResponseError>,
      ),
      Effect.mapError(
        (error: HttpClientError.HttpClientError): GithubPostError =>
          error._tag === 'ResponseError'
            ? mapPostResponseError(operation, path, error)
            : mapRequestError(operation, error as HttpClientError.RequestError),
      ),
    )

  const httpPatch = <$data>(
    path: string,
    data: unknown,
    operation: GithubOperation,
  ): Effect.Effect<$data, GithubApiError> =>
    client.patch(`${BASE_URL}${path}`, { headers, body: jsonBody(data) }).pipe(
      Effect.flatMap((response: HttpClientResponse.HttpClientResponse) =>
        HttpClientResponse.filterStatusOk(response),
      ),
      Effect.flatMap(
        (response) => response.json as Effect.Effect<$data, HttpClientError.ResponseError>,
      ),
      Effect.mapError((error: HttpClientError.HttpClientError) =>
        error._tag === 'ResponseError'
          ? mapResponseError(operation, path, error)
          : mapRequestError(operation, error as HttpClientError.RequestError),
      ),
    )

  return {
    releaseExists: (tag) =>
      httpGet<Release>(`${releasesPath}/tags/${encodeTag(tag)}`, 'releaseExists').pipe(
        Effect.map(() => true),
        Effect.catchTag('GithubNotFoundError', () => Effect.succeed(false)),
      ),

    createRelease: (params) =>
      httpPost<Release>(
        releasesPath,
        {
          tag_name: params.tag,
          name: params.title,
          body: params.body,
          prerelease: params.prerelease ?? false,
        },
        'createRelease',
      ),

    updateRelease: (tag, params) =>
      httpGet<Release>(`${releasesPath}/tags/${encodeTag(tag)}`, 'getRelease').pipe(
        Effect.flatMap((release) =>
          httpPatch<Release>(
            `${releasesPath}/${release.id}`,
            { body: params.body },
            'updateRelease',
          ),
        ),
      ),

    listOpenPullRequests: () =>
      httpGet<readonly PullRequest[]>(
        `${pullsPath}?state=open&per_page=100`,
        'listOpenPullRequests',
      ),

    updatePullRequest: (number, params) =>
      httpPatch<PullRequest>(
        `${pullsPath}/${String(number)}`,
        {
          ...(params.title !== undefined ? { title: params.title } : {}),
          ...(params.body !== undefined ? { body: params.body } : {}),
        } satisfies UpdatePullRequestParams,
        'updatePullRequest',
      ),
  }
}

// ============================================================================
// Layer
// ============================================================================

/**
 * Create a Live GitHub service layer.
 *
 * Requires `FetchHttpClient.layer` or another HttpClient implementation.
 *
 * @example
 * ```ts
 * import { Github } from '@kitz/github'
 * import { FetchHttpClient } from '@effect/platform'
 *
 * const layer = Github.Live({ owner: 'jasonkuhrt', repo: 'kitz' })
 *
 * yield* Github.Github.pipe(
 *   Effect.flatMap((gh) => gh.createRelease({ tag, title, body })),
 *   Effect.provide(layer),
 *   Effect.provide(FetchHttpClient.layer),
 * )
 * ```
 */
export const Live: GithubLiveLayer = (config) =>
  Layer.effect(
    Github,
    Effect.gen(function* () {
      const token = getGithubToken(config.token)
      const client = yield* HttpClient.HttpClient
      return makeGithubService(client, config, token)
    }),
  )

/**
 * Create a fully-provided Live GitHub service layer using FetchHttpClient.
 *
 * @example
 * ```ts
 * import { Github } from '@kitz/github'
 *
 * const layer = Github.LiveFetch({ owner: 'jasonkuhrt', repo: 'kitz' })
 *
 * yield* Github.Github.pipe(
 *   Effect.flatMap((gh) => gh.createRelease({ tag, title, body })),
 *   Effect.provide(layer),
 * )
 * ```
 */
export const LiveFetch: GithubLiveFetchLayer = (config) =>
  Live(config).pipe(Layer.provide(FetchHttpClient.layer))
