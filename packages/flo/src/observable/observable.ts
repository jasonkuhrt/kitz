/**
 * @module observable
 *
 * Generic observable workflow infrastructure for activity lifecycle tracking.
 *
 * Provides {@link ObservableActivity} - a drop-in replacement for `Activity.make()`
 * that emits lifecycle events when {@link WorkflowEvents} service is available.
 *
 * @example
 * ```ts
 * // Instead of Activity.make, use ObservableActivity.create
 * yield* ObservableActivity.create({
 *   name: 'SendEmail',
 *   error: SendEmailError,
 *   execute: sendEmail(to, subject, body),
 * })
 * ```
 */

import { Activity } from 'effect/unstable/workflow'
import { Duration, Effect, Option, PubSub, Schema, ServiceMap } from 'effect'
import * as ActivityTypes from '../models/activity.js'
import * as WorkflowTypes from '../models/workflow.js'

// ─── Combined Event Type ─────────────────────────────────────────────────────

/**
 * Any workflow or activity lifecycle event.
 */
export type LifecycleEvent = ActivityTypes.Event | WorkflowTypes.Event

/**
 * Schema for all lifecycle events.
 */
export const LifecycleEvent = Schema.Union([ActivityTypes.Event, WorkflowTypes.Event])

// ─── Event PubSub Service ────────────────────────────────────────────────────

/**
 * Service for publishing workflow events.
 *
 * When provided, {@link ObservableActivity.make} emits lifecycle events.
 * When not provided, activities execute normally without event emission.
 */
export class WorkflowEvents extends ServiceMap.Service<
  WorkflowEvents,
  PubSub.PubSub<LifecycleEvent>
>()('@kitz/flo/WorkflowEvents') {}

// ─── Observable Activity ─────────────────────────────────────────────────────

/** Threshold - activities completing faster than this are considered resumed */
const RESUME_THRESHOLD = Duration.millis(50)

type ObservableActivityError<E extends Schema.Top> = E['Type'] & { readonly _tag: string }

/**
 * Observable drop-in replacement for `Activity.make()`.
 *
 * When {@link WorkflowEvents} service is provided, emits lifecycle events:
 * - `ActivityStarted` when activity begins
 * - `ActivityCompleted` when activity succeeds
 * - `ActivityFailed` when activity fails
 *
 * When WorkflowEvents is not provided, behaves exactly like `Activity.make()`.
 *
 * **Resume detection**: Activities completing in <50ms are flagged with `resumed: true`,
 * indicating they were replayed from a checkpoint rather than freshly executed.
 *
 * @example
 * ```ts
 * // Basic usage - same as Activity.make
 * yield* ObservableActivity.create({
 *   name: 'PublishPackage',
 *   error: PublishError,
 *   execute: publishToNpm(packageName, version),
 * })
 *
 * // With retry
 * yield* ObservableActivity.create({
 *   name: 'PushTags',
 *   error: GitError,
 *   execute: git.pushTags(),
 *   retry: { times: 2 },
 * })
 * ```
 */
export const ObservableActivity = {
  /**
   * Create an observable activity.
   *
   * Same API as `Activity.make()` but emits lifecycle events.
   *
   * @param config.retry - Optional retry configuration (mirrors Activity.retry)
   */
  create: <R, E extends Schema.Top = typeof Schema.Never>(config: {
    readonly name: string
    readonly error?: E | undefined
    readonly execute: Effect.Effect<void, ObservableActivityError<E>, R>
    readonly retry?: { times: number }
  }): Effect.Effect<void, ObservableActivityError<E>, R> =>
    Effect.gen(function* () {
      const maybePubsub = yield* Effect.serviceOption(WorkflowEvents)

      // No event service - just run the activity
      if (Option.isNone(maybePubsub)) {
        let activity = Activity.make({
          name: config.name,
          error: config.error,
          execute: config.execute,
        }).asEffect() as Effect.Effect<void, ObservableActivityError<E>, R>
        if (config.retry) {
          activity = activity.pipe(Activity.retry(config.retry))
        }
        return yield* activity
      }

      const pubsub = maybePubsub.value
      const startTime = new Date()

      // Emit started
      yield* PubSub.publish(
        pubsub,
        ActivityTypes.Started.make({
          activity: config.name,
          timestamp: startTime,
          resumed: false,
        }),
      ).pipe(Effect.ignore)

      const publishFailure = (error: ObservableActivityError<E>) => {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error)
        return PubSub.publish(
          pubsub,
          ActivityTypes.Failed.make({
            activity: config.name,
            timestamp: new Date(),
            error: errorMessage,
          }),
        ).pipe(Effect.ignore)
      }

      let activity = Activity.make({
        name: config.name,
        error: config.error,
        execute: config.execute.pipe(Effect.tapError(publishFailure)),
      }).asEffect() as Effect.Effect<void, ObservableActivityError<E>, R>
      if (config.retry) {
        activity = activity.pipe(Activity.retry(config.retry))
      }

      // Run the actual activity with timing
      const [duration, result] = yield* activity.pipe(
        Effect.timed,
      )

      // Emit completed
      yield* PubSub.publish(
        pubsub,
        ActivityTypes.Completed.make({
          activity: config.name,
          timestamp: new Date(),
          resumed: Duration.isLessThan(duration, RESUME_THRESHOLD),
          durationMs: Duration.toMillis(duration),
        }),
      ).pipe(Effect.ignore)

      return result
    }) as any, // Cast needed because serviceOption changes R
}
