import { Effect, Fiber, Layer } from 'effect'
import {
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from 'effect/unstable/http'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { getGithubToken } from './env.js'
import { Github } from './_.js'

interface RequestRecord {
  readonly method: string
  readonly url: string
  readonly headers: Record<string, string | undefined>
  readonly bodyText: string | undefined
}

type MockRouteHandler = (
  request: HttpClientRequest.HttpClientRequest,
  url: URL,
  signal: AbortSignal,
  fiber: Fiber.Fiber<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>,
) => Effect.Effect<
  Response | HttpClientResponse.HttpClientResponse,
  HttpClientError.HttpClientError
>

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

const makeHttpLayer = (handler: MockRouteHandler) => {
  const requests: RequestRecord[] = []

  const client = HttpClient.make((request, url, signal, fiber) => {
    const body = (request as any).body
    const rawBody = body?._tag === 'Uint8Array' ? body.body : undefined
    const bodyText =
      rawBody === undefined
        ? undefined
        : typeof rawBody === 'string'
          ? rawBody
          : new TextDecoder().decode(rawBody)

    requests.push({
      method: request.method,
      url: url.toString(),
      headers: { ...request.headers },
      bodyText,
    })

    return handler(request, url, signal, fiber).pipe(
      Effect.map((response) =>
        response instanceof Response ? HttpClientResponse.fromWeb(request, response) : response,
      ),
    )
  })

  return {
    requests,
    layer: Layer.succeed(HttpClient.HttpClient, client),
  }
}

const provideLive = (
  layer: Layer.Layer<HttpClient.HttpClient>,
  config: { owner: string; repo: string; token?: string } = {
    owner: 'kitz',
    repo: 'repo',
    token: 'test-token',
  },
) => Github.Live(config).pipe(Layer.provide(layer))

const transportError = (request: HttpClientRequest.HttpClientRequest, description: string) =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({
      request,
      description,
      cause: new Error(description),
    }),
  })

const expectGithubError = (error: unknown): Github.GithubError => {
  expect(error).toBeInstanceOf(Github.GithubError)
  if (!(error instanceof Github.GithubError)) {
    throw new Error('Expected GithubError')
  }
  return error
}

const expectGithubAuthError = (error: unknown): Github.GithubAuthError => {
  expect(error).toBeInstanceOf(Github.GithubAuthError)
  if (!(error instanceof Github.GithubAuthError)) {
    throw new Error('Expected GithubAuthError')
  }
  return error
}

const expectGithubRateLimitError = (error: unknown): Github.GithubRateLimitError => {
  expect(error).toBeInstanceOf(Github.GithubRateLimitError)
  if (!(error instanceof Github.GithubRateLimitError)) {
    throw new Error('Expected GithubRateLimitError')
  }
  return error
}

afterEach(() => {
  delete process.env[`GITHUB_TOKEN`]
  vi.unstubAllGlobals()
})

describe('getGithubToken', () => {
  test('prefers explicit tokens over the environment and falls back to GITHUB_TOKEN', () => {
    process.env[`GITHUB_TOKEN`] = 'env-token'

    expect(getGithubToken('explicit-token')).toBe('explicit-token')
    expect(getGithubToken(undefined)).toBe('env-token')

    delete process.env[`GITHUB_TOKEN`]
    expect(getGithubToken(undefined)).toBeUndefined()
  })
})

describe('Github.Live', () => {
  test('covers the success paths for release, PR, and issue-comment operations', async () => {
    const issueCommentsPage1 = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      body: `comment ${index + 1}`,
      html_url: `https://github.com/kitz/repo/issues/1#issuecomment-${index + 1}`,
      user: { type: 'User' },
    }))
    const issueCommentsPage2 = [
      {
        id: 101,
        body: '<!-- marker -->\nmatch',
        html_url: 'https://github.com/kitz/repo/issues/1#issuecomment-101',
        user: { type: 'Bot' },
      },
    ]

    const http = makeHttpLayer((request, url) => {
      const path = `${request.method} ${url.pathname}${url.search}`

      switch (path) {
        case 'GET /repos/kitz/repo/releases/tags/v1.2.3':
          return Effect.succeed(
            jsonResponse({
              id: 10,
              tag_name: 'v1.2.3',
            }),
          )
        case 'POST /repos/kitz/repo/releases':
          return Effect.succeed(
            jsonResponse({
              id: 11,
              tag_name: 'v1.2.4',
              name: 'Release v1.2.4',
              body: 'notes',
              prerelease: false,
            }),
          )
        case 'GET /repos/kitz/repo/releases/tags/v1.2.4':
          return Effect.succeed(
            jsonResponse({
              id: 11,
              tag_name: 'v1.2.4',
              body: 'notes',
            }),
          )
        case 'PATCH /repos/kitz/repo/releases/11':
          return Effect.succeed(
            jsonResponse({
              id: 11,
              tag_name: 'v1.2.4',
              body: 'updated notes',
            }),
          )
        case 'GET /repos/kitz/repo/pulls?state=open&per_page=100':
          return Effect.succeed(
            jsonResponse([
              {
                number: 7,
                html_url: 'https://github.com/kitz/repo/pull/7',
                title: 'feat: release',
                body: 'body',
                base: { ref: 'main' },
                head: { ref: 'feat/release' },
              },
            ]),
          )
        case 'PATCH /repos/kitz/repo/pulls/7':
          return Effect.succeed(
            jsonResponse({
              number: 7,
              html_url: 'https://github.com/kitz/repo/pull/7',
              title: 'feat: updated release',
              body: 'updated body',
              base: { ref: 'main' },
              head: { ref: 'feat/release' },
            }),
          )
        case 'GET /repos/kitz/repo/issues/1/comments?per_page=100&page=1':
          return Effect.succeed(jsonResponse(issueCommentsPage1))
        case 'GET /repos/kitz/repo/issues/1/comments?per_page=100&page=2':
          return Effect.succeed(jsonResponse(issueCommentsPage2))
        case 'POST /repos/kitz/repo/issues/1/comments':
          return Effect.succeed(
            jsonResponse({
              id: 102,
              body: '<!-- marker -->\nnew comment',
              html_url: 'https://github.com/kitz/repo/issues/1#issuecomment-102',
              user: { type: 'Bot' },
            }),
          )
        case 'PATCH /repos/kitz/repo/issues/comments/101':
          return Effect.succeed(
            jsonResponse({
              id: 101,
              body: '<!-- marker -->\nupdated comment',
              html_url: 'https://github.com/kitz/repo/issues/1#issuecomment-101',
              user: { type: 'Bot' },
            }),
          )
        default:
          return Effect.fail(transportError(request, `Unhandled ${path}`))
      }
    })

    const layer = provideLive(http.layer)

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const github = yield* Github.Github

        const releaseExists = yield* github.releaseExists('v1.2.3')
        const created = yield* github.createRelease({
          tag: 'v1.2.4',
          title: 'Release v1.2.4',
          body: 'notes',
        })
        const updatedRelease = yield* github.updateRelease('v1.2.4', {
          body: 'updated notes',
        })
        const pullRequests = yield* github.listOpenPullRequests()
        const updatedPull = yield* github.updatePullRequest(7, {
          title: 'feat: updated release',
          body: 'updated body',
        })
        const comments = yield* github.listIssueComments(1)
        const markerComment = yield* github.findIssueCommentByMarker(1, '<!-- marker -->')
        const createdComment = yield* github.createIssueComment({
          issueNumber: 1,
          body: '<!-- marker -->\nnew comment',
        })
        const updatedComment = yield* github.updateIssueComment(101, {
          body: '<!-- marker -->\nupdated comment',
        })
        const upsertedExisting = yield* github.upsertIssueComment({
          issueNumber: 1,
          marker: '<!-- marker -->',
          body: '<!-- marker -->\nupdated comment',
          existingComment: markerComment,
        })
        const upsertedDiscovered = yield* github.upsertIssueComment({
          issueNumber: 1,
          marker: '<!-- marker -->',
          body: '<!-- marker -->\nupdated comment',
        })
        const upsertedCreated = yield* github.upsertIssueComment({
          issueNumber: 1,
          marker: '<!-- missing -->',
          body: '<!-- marker -->\nnew comment',
        })

        return {
          releaseExists,
          created,
          updatedRelease,
          pullRequests,
          updatedPull,
          comments,
          markerComment,
          createdComment,
          updatedComment,
          upsertedExisting,
          upsertedDiscovered,
          upsertedCreated,
        }
      }).pipe(Effect.provide(layer)),
    )

    expect(result.releaseExists).toBe(true)
    expect(result.created.prerelease).toBe(false)
    expect(result.updatedRelease.body).toBe('updated notes')
    expect(result.pullRequests).toHaveLength(1)
    expect(result.updatedPull.title).toBe('feat: updated release')
    expect(result.comments).toHaveLength(101)
    expect(result.markerComment?.id).toBe(101)
    expect(result.createdComment.id).toBe(102)
    expect(result.updatedComment.id).toBe(101)
    expect(result.upsertedExisting.id).toBe(101)
    expect(result.upsertedDiscovered.id).toBe(101)
    expect(result.upsertedCreated.id).toBe(102)

    expect(http.requests[0]?.headers[`authorization`]).toBe('Bearer test-token')
    expect(http.requests[1]?.bodyText).toContain('"tag_name":"v1.2.4"')
    expect(http.requests[5]?.bodyText).toContain('"title":"feat: updated release"')
  })

  test('maps GET errors to typed github errors', async () => {
    const rateLimitReset = Math.floor(new Date('2026-01-01T00:00:00.000Z').getTime() / 1000)

    const http = makeHttpLayer((request, url) => {
      const path = `${request.method} ${url.pathname}`

      switch (path) {
        case 'GET /repos/kitz/repo/releases/tags/missing':
          return Effect.succeed(jsonResponse({ message: 'missing' }, { status: 404 }))
        case 'GET /repos/kitz/repo/releases/tags/auth':
          return Effect.succeed(jsonResponse({ message: 'auth' }, { status: 401 }))
        case 'GET /repos/kitz/repo/releases/tags/rate':
          return Effect.succeed(
            jsonResponse(
              { message: 'rate limited' },
              {
                status: 403,
                headers: {
                  'x-ratelimit-remaining': '0',
                  'x-ratelimit-reset': String(rateLimitReset),
                },
              },
            ),
          )
        case 'GET /repos/kitz/repo/releases/tags/failure':
          return Effect.fail(transportError(request, 'socket closed'))
        default:
          return Effect.succeed(jsonResponse({ message: 'boom' }, { status: 500 }))
      }
    })

    const layer = provideLive(http.layer)

    const missing = await Effect.runPromise(
      Effect.gen(function* () {
        const github = yield* Github.Github
        return yield* github.releaseExists('missing')
      }).pipe(Effect.provide(layer)),
    )
    const auth = await Effect.runPromise(
      Effect.gen(function* () {
        const github = yield* Github.Github
        return yield* Effect.flip(github.releaseExists('auth'))
      }).pipe(Effect.provide(layer)),
    )
    const rate = await Effect.runPromise(
      Effect.gen(function* () {
        const github = yield* Github.Github
        return yield* Effect.flip(github.releaseExists('rate'))
      }).pipe(Effect.provide(layer)),
    )
    const failure = await Effect.runPromise(
      Effect.gen(function* () {
        const github = yield* Github.Github
        return yield* Effect.flip(github.releaseExists('failure'))
      }).pipe(Effect.provide(layer)),
    )
    const serverError = await Effect.runPromise(
      Effect.gen(function* () {
        const github = yield* Github.Github
        return yield* Effect.flip(github.listOpenPullRequests())
      }).pipe(Effect.provide(layer)),
    )

    expect(missing).toBe(false)
    expectGithubAuthError(auth)
    expect(expectGithubRateLimitError(rate).context.resetAt.toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    )
    expect(expectGithubError(failure).context.detail).toContain('socket closed')
    expect(expectGithubError(serverError).context.status).toBe(500)
  })

  test('maps POST and PATCH errors to the expected github error types', async () => {
    const now = Date.now()
    const http = makeHttpLayer((request, url) => {
      const path = `${request.method} ${url.pathname}`

      switch (path) {
        case 'POST /repos/kitz/repo/releases':
          return Effect.succeed(jsonResponse({ message: 'missing' }, { status: 404 }))
        case 'POST /repos/kitz/repo/issues/1/comments':
          return Effect.succeed(
            jsonResponse(
              { message: 'slow down' },
              {
                status: 403,
                headers: {
                  'x-ratelimit-remaining': '0',
                },
              },
            ),
          )
        case 'PATCH /repos/kitz/repo/pulls/7':
          return Effect.succeed(jsonResponse({ message: 'auth' }, { status: 401 }))
        default:
          return Effect.fail(transportError(request, `${path} failed`))
      }
    })

    const layer = provideLive(http.layer)

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const github = yield* Github.Github

        const createRelease = yield* github
          .createRelease({
            tag: 'v2.0.0',
            title: 'Release v2.0.0',
            body: 'notes',
          })
          .pipe(Effect.flip)
        const createComment = yield* github
          .createIssueComment({
            issueNumber: 1,
            body: 'body',
          })
          .pipe(Effect.flip)
        const updatePull = yield* github
          .updatePullRequest(7, {
            title: 'title',
          })
          .pipe(Effect.flip)

        return { createRelease, createComment, updatePull, now }
      }).pipe(Effect.provide(layer)),
    )

    expect(expectGithubError(result.createRelease).context.status).toBe(404)
    expect(
      expectGithubRateLimitError(result.createComment).context.resetAt.getTime(),
    ).toBeGreaterThanOrEqual(result.now)
    expectGithubAuthError(result.updatePull)
  })
})

describe('Github.LiveFetch', () => {
  test('provides a fully configured live layer backed by fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          id: 1,
          tag_name: 'v3.0.0',
        }),
      ),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const github = yield* Github.Github
        return yield* github.releaseExists('v3.0.0')
      }).pipe(
        Effect.provide(
          Github.LiveFetch({
            owner: 'kitz',
            repo: 'repo',
            token: 'fetch-token',
          }),
        ),
      ),
    )

    expect(result).toBe(true)
  })
})
