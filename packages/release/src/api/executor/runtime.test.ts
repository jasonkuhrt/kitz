import { describe, expect, it as test } from '@effect/vitest'
import { WorkflowEngine } from '@effect/workflow'
import { Duration, Effect } from 'effect'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeWorkflowRuntime } from './runtime.js'

describe('Executor runtime', () => {
  test.effect('builds the SQLite-backed workflow runtime layer', (_ctx) => {
    const tempDir = mkdtempSync(join(tmpdir(), 'kitz-workflow-runtime-'))

    return Effect.gen(function* () {
      try {
        const engine = yield* WorkflowEngine.WorkflowEngine

        expect(engine).toBeDefined()
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    }).pipe(
      Effect.provide(
        makeWorkflowRuntime({
          dbPath: join(tempDir, 'workflow.db'),
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
