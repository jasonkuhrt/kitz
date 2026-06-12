import { Env } from '@kitz/env'
import { Effect } from 'effect'
import { ExecutorPublishError, mapToExecutorError } from '../../errors.js'
import { artifactPathFor, publishPreparedArtifact } from '../../publish.js'
import type { ReleasePayloadType } from '../payload.js'
import { formatTag, type ReleasePayloadEntry, toReleaseInfo } from '../release-info.js'
import { recordSideEffect } from '../side-effects.js'

export const publishRelease = (params: {
  readonly payload: ReleasePayloadType
  readonly publishTag: string | undefined
  readonly release: ReleasePayloadEntry
}) =>
  Effect.gen(function* () {
    const releaseInfo = toReleaseInfo(params.release)
    const tag = formatTag(releaseInfo.package.name, releaseInfo.nextVersion)

    if (params.payload.options.dryRun) {
      yield* Effect.log(`[dry-run] Would publish ${tag}`)
    } else {
      const env = yield* Env.Env
      yield* Effect.log(`Publishing ${tag}...`)
      yield* recordSideEffect({
        payload: params.payload,
        kind: 'registry-publish',
        subject: tag,
        planned: {
          packageName: params.release.packageName,
          version: params.release.nextVersion,
          distTag: params.publishTag ?? null,
          registry: params.payload.options.registry ?? null,
        },
        effect: publishPreparedArtifact(
          {
            ...releaseInfo,
            tarball: artifactPathFor(
              env.cwd,
              releaseInfo,
              params.payload.options.planDigest === undefined
                ? undefined
                : { planDigest: params.payload.options.planDigest },
            ),
          },
          {
            ...(params.publishTag !== undefined ? { tag: params.publishTag } : {}),
            ...(params.payload.options.registry && { registry: params.payload.options.registry }),
            packageManager: params.payload.options.publishInvoker,
          },
        ).pipe(Effect.as(params.release.packageName)),
      })
    }

    return params.release.packageName
  }).pipe(
    mapToExecutorError(
      (detail) =>
        new ExecutorPublishError({
          context: { packageName: params.release.packageName, detail },
        }),
    ),
  )
