import { Effect } from 'effect'
import { describe, expect, test } from 'bun:test'
import { Github } from './_.js'

const collectOperations = (gh: Github.GithubService) =>
  Effect.all([
    Effect.map(gh.releaseExists('v1.0.0').pipe(Effect.flip), (e) => ['releaseExists', e] as const),
    Effect.map(
      gh.createRelease({ tag: 'v1.0.0', title: 't', body: 'b' }).pipe(Effect.flip),
      (e) => ['createRelease', e] as const,
    ),
    Effect.map(
      gh.updateRelease('v1.0.0', { body: 'b' }).pipe(Effect.flip),
      (e) => ['updateRelease', e] as const,
    ),
    Effect.map(
      gh.listOpenPullRequests().pipe(Effect.flip),
      (e) => ['listOpenPullRequests', e] as const,
    ),
    Effect.map(
      gh.updatePullRequest(1, { title: 't' }).pipe(Effect.flip),
      (e) => ['updatePullRequest', e] as const,
    ),
    Effect.map(gh.listIssueComments(1).pipe(Effect.flip), (e) => ['listIssueComments', e] as const),
    Effect.map(
      gh.findIssueCommentByMarker(1, '<!-- m -->').pipe(Effect.flip),
      (e) => ['findIssueCommentByMarker', e] as const,
    ),
    Effect.map(
      gh.createIssueComment({ issueNumber: 1, body: 'b' }).pipe(Effect.flip),
      (e) => ['createIssueComment', e] as const,
    ),
    Effect.map(
      gh.updateIssueComment(1, { body: 'b' }).pipe(Effect.flip),
      (e) => ['updateIssueComment', e] as const,
    ),
    Effect.map(
      gh.upsertIssueComment({ issueNumber: 1, body: 'b', marker: '<!-- m -->' }).pipe(Effect.flip),
      (e) => ['upsertIssueComment', e] as const,
    ),
  ])

describe('Github.Unconfigured', () => {
  test('every operation fails with a GithubError naming that exact operation', async () => {
    const failures = await Effect.runPromise(
      Effect.gen(function* () {
        const gh = yield* Github.Github
        return yield* collectOperations(gh)
      }).pipe(Effect.provide(Github.Unconfigured.layer)),
    )

    // The full service surface is covered.
    expect(failures).toHaveLength(10)

    for (const [operation, error] of failures) {
      expect(error._tag).toBe('GithubError')
      if (error._tag !== 'GithubError') throw new Error('expected GithubError')
      // Regression: findIssueCommentByMarker and upsertIssueComment used to be
      // mislabeled as listIssueComments / createIssueComment.
      expect(error.context.operation).toBe(operation)
      expect(error.context.detail).toContain('GitHub service is not configured')
    }
  })

  test('make accepts a custom guidance detail', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const gh = yield* Github.Github
        return yield* gh.releaseExists('v1.0.0').pipe(Effect.flip)
      }).pipe(
        Effect.provide(
          Github.Unconfigured.make({ detail: 'Resolve runtime with explore() first.' }),
        ),
      ),
    )

    expect(error._tag).toBe('GithubError')
    if (error._tag !== 'GithubError') throw new Error('expected GithubError')
    expect(error.context.operation).toBe('releaseExists')
    expect(error.context.detail).toBe('Resolve runtime with explore() first.')
  })
})
