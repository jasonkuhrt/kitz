/**
 * @module executor/runtime
 *
 * Effect layer composition for workflow execution.
 * Provides SQLite persistence, filesystem, and GitHub service layers.
 */

import { SingleRunner } from '@effect/cluster'
import { NodeFileSystem, NodePath } from '@effect/platform-node'
import { SqliteClient } from '@effect/sql-sqlite-node'
import { Workflow as EffectWorkflow, WorkflowEngine } from '@effect/workflow'
import { Github } from '@kitz/github'
import { Effect, Layer, Schema } from 'effect'

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
  /** GitHub configuration for release creation */
  readonly github?: {
    readonly owner: string
    readonly repo: string
    readonly token?: string
  }
}

/**
 * Create the full workflow runtime layer with SQLite persistence.
 */
export const makeRuntime = (config: RuntimeConfig = {}) =>
  Layer.mergeAll(
    SqliteClient.layer({ filename: config.dbPath ?? DEFAULT_DB }),
    NodeFileSystem.layer,
    NodePath.layer,
    WorkflowEngine.layerMemory,
    config.github
      ? Github.LiveFetch(config.github)
      : Layer.succeed(Github.Github, {
        releaseExists: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'releaseExists',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        createRelease: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'createRelease',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
        updateRelease: () =>
          Effect.fail(
            new Github.GithubError({
              context: {
                operation: 'updateRelease',
                detail:
                  'GitHub runtime is not configured. Resolve runtime with Api.Explorer.explore() and pass github config.',
              },
              cause: new Error('GitHub runtime is not configured'),
            }),
          ),
      }),
  ).pipe(
    Layer.provideMerge(SingleRunner.layer({ runnerStorage: 'sql' })),
  )

/**
 * A minimal workflow definition for test mocking.
 */
const TestWorkflowDef = EffectWorkflow.make({
  name: 'TestWorkflow',
  payload: Schema.Struct({ id: Schema.String }),
  idempotencyKey: (payload) => payload.id,
  success: Schema.Void,
})

/**
 * Create a test-friendly workflow runtime using in-memory engine.
 *
 * Provides both WorkflowEngine and a mock WorkflowInstance for testing
 * activities without going through the full workflow execution flow.
 */
export const makeTestRuntime = () =>
  Layer.mergeAll(
    WorkflowEngine.layerMemory,
    Layer.succeed(
      WorkflowEngine.WorkflowInstance,
      WorkflowEngine.WorkflowInstance.initial(TestWorkflowDef, 'test-execution-id'),
    ),
  )
