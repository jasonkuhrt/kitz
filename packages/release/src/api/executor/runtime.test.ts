import { describe, expect, test } from 'bun:test'
import { Test } from '@kitz/test'
import { WorkflowEngine } from 'effect/unstable/workflow'
import { Github } from '@kitz/github'
import { Fs } from '@kitz/fs'
import { Duration, Effect } from 'effect'
import { makeRuntime, makeTestRuntime, makeWorkflowRuntime } from './runtime.js'
import { FileSystemLayer } from '../../platform.js'

describe('Executor runtime', () => {
  Test.effect('builds the SQLite-backed workflow runtime layer', () => {
    const dbPath = Fs.Path.AbsFile.fromString(
      `/tmp/kitz-workflow-runtime-${crypto.randomUUID()}/missing/workflow.db`,
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
      Effect.provide(FileSystemLayer),
    )
  })

  Test.effect('provides a helpful fallback github runtime when github config is absent', () =>
    Effect.gen(function* () {
      const github = yield* Github.Github

      const operations = yield* Effect.all([
        Effect.map(
          github.releaseExists('v1.0.0').pipe(Effect.result),
          (result) => ['releaseExists', result] as const,
        ),
        Effect.map(
          github
            .createRelease({ tag: 'v1.0.0', title: 'release', body: 'body' })
            .pipe(Effect.result),
          (result) => ['createRelease', result] as const,
        ),
        Effect.map(
          github.updateRelease('v1.0.0', { body: 'body' }).pipe(Effect.result),
          (result) => ['updateRelease', result] as const,
        ),
        Effect.map(
          github.listOpenPullRequests().pipe(Effect.result),
          (result) => ['listOpenPullRequests', result] as const,
        ),
        Effect.map(
          github.updatePullRequest(1, { title: 'title' }).pipe(Effect.result),
          (result) => ['updatePullRequest', result] as const,
        ),
        Effect.map(
          github.listIssueComments(1).pipe(Effect.result),
          (result) => ['listIssueComments', result] as const,
        ),
        Effect.map(
          github.findIssueCommentByMarker(1, '<!-- marker -->').pipe(Effect.result),
          (result) => ['findIssueCommentByMarker', result] as const,
        ),
        Effect.map(
          github.createIssueComment({ issueNumber: 1, body: 'body' }).pipe(Effect.result),
          (result) => ['createIssueComment', result] as const,
        ),
        Effect.map(
          github.updateIssueComment(1, { body: 'body' }).pipe(Effect.result),
          (result) => ['updateIssueComment', result] as const,
        ),
        Effect.map(
          github
            .upsertIssueComment({ issueNumber: 1, body: 'body', marker: '<!-- marker -->' })
            .pipe(Effect.result),
          (result) => ['upsertIssueComment', result] as const,
        ),
      ])

      for (const [operation, result] of operations) {
        expect(result._tag).toBe('Failure')
        if (result._tag === 'Failure') {
          expect(result.failure._tag).toBe('GithubError')
          // Regression: findIssueCommentByMarker and upsertIssueComment used to
          // report listIssueComments / createIssueComment.
          expect(result.failure.context.operation).toBe(operation)
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
      Effect.provide(FileSystemLayer),
    ),
  )

  Test.effect('builds the in-memory workflow runtime layer for tests', () =>
    Effect.gen(function* () {
      const engine = yield* WorkflowEngine.WorkflowEngine
      expect(engine).toBeDefined()
    }).pipe(Effect.provide(makeTestRuntime())),
  )
})
