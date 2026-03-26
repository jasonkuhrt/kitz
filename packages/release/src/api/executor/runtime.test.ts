import { describe, expect, it as test } from '@effect/vitest'
import { WorkflowEngine } from 'effect/unstable/workflow'
import { Github } from '@kitz/github'
import { Fs } from '@kitz/fs'
import { Duration, Effect } from 'effect'
import { makeRuntime, makeTestRuntime, makeWorkflowRuntime } from './runtime.js'

describe('Executor runtime', () => {
  test.effect('builds the SQLite-backed workflow runtime layer', (_ctx) => {
    const dbPath = Fs.Path.AbsFile.fromString(
      `/tmp/kitz-workflow-runtime-${crypto.randomUUID()}.db`,
    )

    return Effect.gen(function* () {
      const engine = yield* WorkflowEngine.WorkflowEngine
      expect(engine).toBeDefined()
    }).pipe(
      Effect.provide(
        makeWorkflowRuntime({
          dbPath: Fs.Path.toString(dbPath),
          shardingConfig: {
            entityMessagePollInterval: Duration.millis(10),
            entityReplyPollInterval: Duration.millis(10),
            refreshAssignmentsInterval: Duration.millis(10),
            shardLockRefreshInterval: Duration.millis(25),
            shardLockExpiration: Duration.seconds(1),
          },
        }),
      ),
    )
  })

  test.effect('provides a helpful fallback github runtime when github config is absent', (_ctx) =>
    Effect.gen(function* () {
      const github = yield* Github.Github

      const operations = yield* Effect.all([
        github.releaseExists('v1.0.0').pipe(Effect.result),
        github.createRelease({ tag: 'v1.0.0', title: 'release', body: 'body' }).pipe(Effect.result),
        github.updateRelease('v1.0.0', { body: 'body' }).pipe(Effect.result),
        github.listOpenPullRequests().pipe(Effect.result),
        github.updatePullRequest(1, { title: 'title' }).pipe(Effect.result),
        github.listIssueComments(1).pipe(Effect.result),
        github.findIssueCommentByMarker(1, '<!-- marker -->').pipe(Effect.result),
        github.createIssueComment({ issueNumber: 1, body: 'body' }).pipe(Effect.result),
        github.updateIssueComment(1, { body: 'body' }).pipe(Effect.result),
        github
          .upsertIssueComment({ issueNumber: 1, body: 'body', marker: '<!-- marker -->' })
          .pipe(Effect.result),
      ])

      for (const result of operations) {
        expect(result._tag).toBe('Failure')
        if (result._tag === 'Failure') {
          expect(result.failure._tag).toBe('GithubError')
          const detail =
            'detail' in result.failure.context && typeof result.failure.context.detail === 'string'
              ? result.failure.context.detail
              : ''
          expect(detail).toContain('GitHub runtime is not configured')
        }
      }
    }).pipe(
      Effect.provide(
        makeRuntime({
          dbPath: `/tmp/kitz-runtime-fallback-${crypto.randomUUID()}.db`,
        }),
      ),
    ),
  )

  test.effect('builds the in-memory workflow runtime layer for tests', (_ctx) =>
    Effect.gen(function* () {
      const engine = yield* WorkflowEngine.WorkflowEngine
      expect(engine).toBeDefined()
    }).pipe(Effect.provide(makeTestRuntime())),
  )
})
