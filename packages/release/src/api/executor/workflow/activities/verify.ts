import { Effect } from 'effect'
import { verifyRegistryPublication } from '../../registry-verification.js'
import { ExecutorPublishError, mapToExecutorError } from '../../errors.js'
import type { ReleasePayloadType } from '../payload.js'
import { type ReleasePayloadEntry, toReleaseInfo } from '../release-info.js'

export const verifyPublishedRelease = (params: {
  readonly payload: ReleasePayloadType
  readonly publishTag: string | undefined
  readonly release: ReleasePayloadEntry
}) =>
  Effect.gen(function* () {
    if (params.payload.options.dryRun) {
      yield* Effect.log(
        `[dry-run] Would verify registry version: ${params.release.packageName}@${params.release.nextVersion}`,
      )
      return params.release.packageName
    }

    yield* Effect.log(
      `Verifying registry version: ${params.release.packageName}@${params.release.nextVersion}`,
    )
    const distTag = params.publishTag ?? 'latest'
    // Only the verification probe gets wrapped, so the explicit
    // ExecutorPublishError below can never be double-wrapped.
    const verification = yield* verifyRegistryPublication({
      packageName: params.release.packageName,
      nextVersion: params.release.nextVersion,
      releaseInfo: toReleaseInfo(params.release),
      distTag,
      packDriver: params.payload.options.packDriver,
      official: params.payload.options.lifecycle === 'official',
      ...(params.payload.options.planDigest !== undefined
        ? { planDigest: params.payload.options.planDigest }
        : {}),
      ...(params.payload.options.registry !== undefined
        ? { registry: params.payload.options.registry }
        : {}),
    }).pipe(
      mapToExecutorError(
        (detail) =>
          new ExecutorPublishError({
            context: { packageName: params.release.packageName, detail },
          }),
      ),
    )
    if (verification.issues.length > 0) {
      return yield* Effect.fail(
        new ExecutorPublishError({
          context: {
            packageName: params.release.packageName,
            detail: verification.issues.map((issue) => issue.detail).join('\n'),
          },
        }),
      )
    }

    return params.release.packageName
  })
