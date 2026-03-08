import { FileSystem } from '@effect/platform'
import { NodeFileSystem } from '@effect/platform-node'
import { describe, expect, it as test } from '@effect/vitest'
import { WorkflowEngine } from '@effect/workflow'
import { Duration, Effect, Schema } from 'effect'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeWorkflowRuntime } from './runtime.js'

const packageRoot = decodeURIComponent(new URL('../../../', import.meta.url).pathname)
const runtimeSourcePath = `${packageRoot}src/api/executor/runtime.ts`
const packageJsonPath = `${packageRoot}package.json`

const PackageJsonSchema = Schema.Struct({
  imports: Schema.Struct({
    '#platform:executor/sqlite-client': Schema.Struct({
      types: Schema.String,
      bun: Schema.String,
      default: Schema.String,
    }),
  }),
})

const decodePackageJson = Schema.decodeUnknown(Schema.parseJson(PackageJsonSchema))

const readFileString = (path: string) =>
  FileSystem.FileSystem.pipe(
    Effect.flatMap((fs) => fs.readFileString(path).pipe(Effect.orDie)),
    Effect.provide(NodeFileSystem.layer),
  )

describe('Executor runtime', () => {
  test.effect('selects the sqlite client through package imports', () =>
    Effect.gen(function* () {
      const packageJson = yield* readFileString(packageJsonPath).pipe(
        Effect.flatMap((manifest) => decodePackageJson(manifest)),
        Effect.orDie,
      )
      const runtimeSource = yield* readFileString(runtimeSourcePath)

      expect(packageJson.imports['#platform:executor/sqlite-client']).toEqual({
        types: './src/api/executor/sqlite-client.node.ts',
        bun: './src/api/executor/sqlite-client.bun.ts',
        default: './src/api/executor/sqlite-client.node.ts',
      })
      expect(runtimeSource).toContain(`from '#platform:executor/sqlite-client'`)
      expect(runtimeSource).not.toContain(`'Bun' in globalThis`)
      expect(runtimeSource).not.toContain(`globalThis.Bun`)
      expect(runtimeSource).not.toContain(`@effect/sql-sqlite-bun`)
      expect(runtimeSource).not.toContain(`@effect/sql-sqlite-node`)
      expect(runtimeSource).not.toContain(`await import(`)
    }),
  )

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
