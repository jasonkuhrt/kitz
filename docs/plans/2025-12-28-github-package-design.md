# @kitz/github Package Design

Effect-based GitHub API client with full typings and enumerated error cases.

## Overview

Create a new `@kitz/github` package providing typed GitHub API access via Effect. Initial scope covers release operations needed by `@kitz/release` workflow. Architecture establishes patterns for expanding to PRs, issues, workflows later.

## Decisions

| Aspect | Decision                         | Rationale                            |
| ------ | -------------------------------- | ------------------------------------ |
| Types  | `@octokit/types`                 | GitHub-maintained, zero runtime deps |
| HTTP   | Effect HttpClient                | Native Effect, already in workspace  |
| Scope  | Releases only (3 ops)            | Depth-first, patterns enable breadth |
| Errors | 4 typed error classes            | Match `@kitz/git` granularity        |
| Config | Service-level `{ owner, repo }`  | Clean call sites                     |
| Auth   | `GITHUB_TOKEN` env with override | Matches `gh` CLI convention          |

## Package Structure

```
packages/github/
├── package.json          # @kitz/github
├── src/
│   ├── _.ts              # Public API barrel (Github namespace)
│   ├── __.ts             # Internal utilities
│   ├── github.ts         # Service interface, errors, Live layer
│   ├── memory.ts         # In-memory implementation for testing
│   └── _.test.ts         # Tests
```

**Dependencies:**

- `@effect/platform` - HttpClient
- `@octokit/types` - TypeScript types (types-only)
- `effect` - Core

## Service Interface

```typescript
type GithubOperation = 'releaseExists' | 'createRelease' | 'updateRelease'

// Errors
const GithubError = Err.TaggedContextualError('GithubError').constrain<{
  readonly operation: GithubOperation
  readonly status?: number
}>()

const GithubNotFoundError = Err.TaggedContextualError('GithubNotFoundError')
  .constrain<{
    readonly operation: GithubOperation
    readonly resource: string
  }>()

const GithubRateLimitError = Err.TaggedContextualError('GithubRateLimitError')
  .constrain<{
    readonly operation: GithubOperation
    readonly resetAt: Date
  }>()

const GithubAuthError = Err.TaggedContextualError('GithubAuthError').constrain<{
  readonly operation: GithubOperation
}>()

// Service
interface GithubService {
  readonly releaseExists: (
    tag: string,
  ) => Effect<boolean, GithubError | GithubAuthError | GithubRateLimitError>

  readonly createRelease: (params: {
    tag: string
    title: string
    body: string
    prerelease?: boolean
  }) => Effect<Release, GithubError | GithubAuthError | GithubRateLimitError>

  readonly updateRelease: (tag: string, params: {
    body: string
  }) => Effect<
    Release,
    GithubError | GithubNotFoundError | GithubAuthError | GithubRateLimitError
  >
}

class Github extends Context.Tag('Github')<Github, GithubService>() {}
```

## Live Layer

```typescript
interface GithubConfig {
  readonly owner: string
  readonly repo: string
  readonly token?: string // Falls back to GITHUB_TOKEN env
}

const Live = (config: GithubConfig): Layer<Github, ConfigError> =>
  Layer.effect(
    Github,
    Effect.gen(function*() {
      const token = config.token ?? process.env.GITHUB_TOKEN
      if (!token) {
        return yield* Effect.fail(
          new ConfigError({
            message:
              'GitHub token required: set GITHUB_TOKEN or pass token option',
          }),
        )
      }

      const baseUrl = 'https://api.github.com'
      const { owner, repo } = config

      return {
        releaseExists: (tag) =>
          httpGet(`/repos/${owner}/${repo}/releases/tags/${tag}`, token).pipe(
            Effect.map(() => true),
            Effect.catchTag('GithubNotFoundError', () => Effect.succeed(false)),
          ),

        createRelease: (params) =>
          httpPost(`/repos/${owner}/${repo}/releases`, token, {
            tag_name: params.tag,
            name: params.title,
            body: params.body,
            prerelease: params.prerelease ?? false,
          }).pipe(Effect.map(parseRelease)),

        updateRelease: (tag, params) =>
          httpGet(`/repos/${owner}/${repo}/releases/tags/${tag}`, token).pipe(
            Effect.flatMap((release) =>
              httpPatch(
                `/repos/${owner}/${repo}/releases/${release.id}`,
                token,
                {
                  body: params.body,
                },
              )
            ),
            Effect.map(parseRelease),
          ),
      }
    }),
  )
```

HTTP helpers wrap Effect HttpClient with:

- Auth header injection (`Authorization: Bearer ${token}`)
- Status code mapping (401 → AuthError, 403 + rate limit → RateLimitError, 404 → NotFoundError)
- Response parsing with `@octokit/types`

## Memory Layer

```typescript
interface GithubMemoryConfig {
  readonly releases?: Record<string, { title: string; body: string; prerelease: boolean }>
}

interface GithubMemoryState {
  readonly releases: Ref.Ref<Record<string, Release>>
  readonly createdReleases: Ref.Ref<Array<{ tag: string; title: string; body: string }>>
  readonly updatedReleases: Ref.Ref<Array<{ tag: string; body: string }>>
}

const make = (config: GithubMemoryConfig = {}): Layer<Github>

const makeWithState = (config: GithubMemoryConfig = {}):
  Effect<{ layer: Layer<Github>; state: GithubMemoryState }>
```

Same pattern as `@kitz/git` Memory layer - configure initial state, track operations for test assertions.

## Usage

```typescript
import { Github } from '@kitz/github'

// Live
const layer = Github.Live({ owner: 'jasonkuhrt', repo: 'kitz' })

yield* Github.Github.pipe(
  Effect.flatMap((gh) => gh.createRelease({ tag, title, body })),
  Effect.provide(layer),
)

// Test
const layer = Github.Memory.make({
  releases: { '@kitz/core@1.0.0': { title: '...', body: '...', prerelease: false } }
})
```

## Integration with Release Workflow

Current code:

```typescript
const existsCmd = Command.make('gh', 'release', 'view', tag)
const exists = yield * Command.exitCode(existsCmd).pipe(
  Effect.map((code) => code === 0),
  Effect.catchAll(() => Effect.succeed(false)),
)
```

After:

```typescript
const github = yield * Github.Github
const exists = yield * github.releaseExists(tag)

if (exists) {
  yield * github.updateRelease(tag, { body: changelog.markdown })
} else {
  yield
    * github.createRelease({
      tag,
      title,
      body: changelog.markdown,
      prerelease: isPreview,
    })
}
```

## Future Expansion

The patterns established enable adding:

- PRs: `getPR`, `createPR`, `updatePR`, `mergePR`
- Issues: `getIssue`, `createIssue`, `addComment`
- Workflows: `triggerWorkflow`, `getWorkflowRun`

Each follows the same structure: add operation to type, add method to service interface, implement in Live/Memory layers.

## GitHub API Reference

| Operation          | Endpoint                                            |
| ------------------ | --------------------------------------------------- |
| Get release by tag | `GET /repos/{owner}/{repo}/releases/tags/{tag}`     |
| Create release     | `POST /repos/{owner}/{repo}/releases`               |
| Update release     | `PATCH /repos/{owner}/{repo}/releases/{release_id}` |
