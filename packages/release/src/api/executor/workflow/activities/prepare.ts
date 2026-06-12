import { Env } from '@kitz/env'
import { Fs } from '@kitz/fs'
import { Effect } from 'effect'
import { ExecutorPublishError, mapToExecutorError } from '../../errors.js'
import {
  artifactPathFor,
  preparePackageArtifact,
  PublishError,
  type ReleaseInfo,
} from '../../publish.js'
import type { ReleasePayloadType } from '../payload.js'
import { formatTag, type ReleasePayloadEntry, toReleaseInfo } from '../release-info.js'

const assertRehearsedArtifactExists = (release: ReleaseInfo, planDigest: string | undefined) =>
  Effect.gen(function* () {
    const env = yield* Env.Env
    const artifact = artifactPathFor(
      env.cwd,
      release,
      planDigest === undefined ? undefined : { planDigest },
    )
    const artifactPath = artifact.toString()
    const exists = yield* Fs.exists(artifact).pipe(Effect.orElseSucceed(() => false))
    if (!exists) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: release.package.path,
            detail: `Rehearsed artifact is missing at ${artifactPath}. Run \`release rehearse\` before \`release apply\`.`,
          },
        }),
      )
    }

    const bytes = yield* Fs.read(artifact)
    if (bytes.length === 0) {
      return yield* Effect.fail(
        new PublishError({
          context: {
            package: release.package.path,
            detail: `Rehearsed artifact is empty at ${artifactPath}. Run \`release rehearse\` before \`release apply\`.`,
          },
        }),
      )
    }
  })

export const prepareRelease = (params: {
  readonly payload: ReleasePayloadType
  readonly plannedReleases: readonly ReleaseInfo[]
  readonly release: ReleasePayloadEntry
}) =>
  Effect.gen(function* () {
    const releaseInfo = toReleaseInfo(params.release)
    const tag = formatTag(releaseInfo.package.name, releaseInfo.nextVersion)

    if (params.payload.options.dryRun) {
      yield* Effect.log(`[dry-run] Would prepare ${tag}`)
    } else if (params.payload.options.rehearsedArtifacts) {
      yield* Effect.log(`Using rehearsed artifact for ${tag}...`)
      yield* assertRehearsedArtifactExists(releaseInfo, params.payload.options.planDigest)
    } else {
      yield* Effect.log(`Preparing ${tag}...`)
      yield* preparePackageArtifact(releaseInfo, params.plannedReleases, {
        packageManager: params.payload.options.packDriver,
        ...(params.payload.options.planDigest === undefined
          ? {}
          : { planDigest: params.payload.options.planDigest }),
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
