import { describe, expect, it as test } from '@effect/vitest'
import { WorkflowEngine } from 'effect/unstable/workflow'
import { Fs } from '@kitz/fs'
import { Duration, Effect } from 'effect'
import { makeWorkflowRuntime } from './runtime.js'

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
})
