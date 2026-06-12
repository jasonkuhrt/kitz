import { Git } from '@kitz/git'
import { Effect } from 'effect'
import { ExecutorTagError, mapToExecutorError } from '../../errors.js'
import type { ReleasePayloadType } from '../payload.js'
import { recordSideEffect } from '../side-effects.js'

export const createTag = (params: { readonly payload: ReleasePayloadType; readonly tag: string }) =>
  Effect.gen(function* () {
    if (params.payload.options.dryRun) {
      yield* Effect.log(`[dry-run] Would create tag: ${params.tag}`)
    } else {
      yield* Effect.log(`Creating tag: ${params.tag}`)
      const gitService = yield* Git.Git
      yield* recordSideEffect({
        payload: params.payload,
        kind: 'git-tag-create',
        subject: params.tag,
        planned: { tag: params.tag, message: `Release ${params.tag}` },
        effect: gitService
          .createTag(params.tag, `Release ${params.tag}`)
          .pipe(Effect.as(params.tag)),
      })
    }
    return params.tag
  }).pipe(
    mapToExecutorError((detail) => new ExecutorTagError({ context: { tag: params.tag, detail } })),
  )

export const pushTag = (params: {
  readonly payload: ReleasePayloadType
  readonly tag: string
  readonly force: boolean
}) =>
  Effect.gen(function* () {
    if (params.payload.options.dryRun) {
      yield* Effect.log(`[dry-run] Would push tag: ${params.tag}`)
    } else {
      yield* Effect.log(`Pushing tag: ${params.tag}`)
      const gitService = yield* Git.Git
      yield* recordSideEffect({
        payload: params.payload,
        kind: 'git-tag-push',
        subject: params.tag,
        planned: { tag: params.tag, remote: 'origin', force: params.force },
        effect: gitService.pushTag(params.tag, 'origin', params.force).pipe(Effect.as(params.tag)),
      })
    }
    return params.tag
  }).pipe(
    mapToExecutorError((detail) => new ExecutorTagError({ context: { tag: params.tag, detail } })),
  )

export const pushTagsAtomic = (params: {
  readonly payload: ReleasePayloadType
  readonly tags: readonly string[]
}) =>
  Effect.gen(function* () {
    yield* Effect.log(`Pushing ${String(params.tags.length)} tags atomically`)
    const gitService = yield* Git.Git
    yield* recordSideEffect({
      payload: params.payload,
      kind: 'git-tag-push',
      subject: params.tags.join(','),
      planned: { tags: params.tags, remote: 'origin', atomic: true },
      effect: gitService
        .pushTagsAtomic(params.tags, 'origin', false)
        .pipe(Effect.as(params.tags.join(','))),
    })
    return params.tags.join(',')
  }).pipe(
    mapToExecutorError(
      (detail) => new ExecutorTagError({ context: { tag: 'atomic-tag-push', detail } }),
    ),
  )
