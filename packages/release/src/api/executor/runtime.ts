/**
 * @module executor/runtime
 *
 * Effect layer composition for workflow execution.
 * Shared runtime composition stays platform-neutral.
 */

import {
  ClusterWorkflowEngine,
  ShardingConfig as ClusterShardingConfig,
  SingleRunner,
} from 'effect/unstable/cluster'
import { SqliteClient } from '#platform:executor/sqlite-client'
import { WorkflowEngine } from 'effect/unstable/workflow'
import { Fs } from '@kitz/fs'
import { Github } from '@kitz/github'
import { Effect, FileSystem, Layer } from 'effect'

/**
 * Default database path for workflow state.
 */
export const DEFAULT_DB = '.release/workflow.db'

/**
 * Configuration for the workflow runtime.
 */
export interface RuntimeConfig {
  /** Path to SQLite database file */
  readonly dbPath?: string
  /** Optional sharding overrides for faster local/testing runners */
  readonly shardingConfig?: Partial<typeof ClusterShardingConfig.defaults>
  /** GitHub configuration for release creation */
  readonly github?: {
    readonly owner: string
    readonly repo: string
    readonly token?: string
  }
}

const dbDirectoryPath = (dbPath: string): string => {
  const file = dbPath.startsWith('/')
    ? Fs.Path.AbsFile.fromString(dbPath)
    : Fs.Path.RelFile.fromString(
        dbPath.startsWith('./') || dbPath.startsWith('../') ? dbPath : `./${dbPath}`,
      )

  return Fs.Path.toString(Fs.Path.toDir(file))
}

const makeWorkflowSqliteLayer = (dbPath: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      yield* fs.makeDirectory(dbDirectoryPath(dbPath), { recursive: true })

      return SqliteClient.layer({ filename: dbPath })
    }),
  )

/**
 * Create the durable workflow engine layer with SQLite-backed state.
 */
export const makeWorkflowRuntime = (
  config: Pick<RuntimeConfig, 'dbPath' | 'shardingConfig'> = {},
) => {
  const dbPath = config.dbPath ?? DEFAULT_DB

  return ClusterWorkflowEngine.layer.pipe(
    Layer.provide(
      SingleRunner.layer({
        runnerStorage: 'sql',
        ...(config.shardingConfig && { shardingConfig: config.shardingConfig }),
      }),
    ),
    Layer.provideMerge(makeWorkflowSqliteLayer(dbPath)),
  )
}

const makeGithubRuntime = (github?: RuntimeConfig['github']) =>
  github
    ? Github.LiveFetch(github)
    : Github.Unconfigured.make({
        detail:
          'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
      })

/**
 * Create the shared workflow runtime layers.
 *
 * Filesystem and other platform services stay abstract and must be provided
 * by the runtime boundary that executes the workflow.
 */
export const makeRuntime = (config: RuntimeConfig = {}) =>
  Layer.mergeAll(
    makeWorkflowRuntime({
      ...(config.dbPath && { dbPath: config.dbPath }),
      ...(config.shardingConfig && { shardingConfig: config.shardingConfig }),
    }),
    makeGithubRuntime(config.github),
  )

/**
 * Create a test-friendly workflow runtime using in-memory engine.
 *
 * Provides both WorkflowEngine and a mock WorkflowInstance for testing
 * activities without going through the full workflow execution flow.
 */
export const makeTestRuntime = () => WorkflowEngine.layerMemory
