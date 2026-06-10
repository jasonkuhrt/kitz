import type { ReleasePayloadType } from './payload.js'

export const releaseWorkflowIdempotencyKey = (payload: ReleasePayloadType): string =>
  JSON.stringify({
    options: {
      dryRun: payload.options.dryRun,
      tag: payload.options.tag ?? null,
      registry: payload.options.registry ?? null,
      planDigest: payload.options.planDigest ?? null,
      rehearsedArtifacts: payload.options.rehearsedArtifacts,
      atomicTagPush: payload.options.atomicTagPush,
      lifecycle: payload.options.lifecycle ?? null,
      trunk: payload.options.trunk ?? null,
      packDriver: payload.options.packDriver,
      publishInvoker: payload.options.publishInvoker,
    },
    releases: payload.releases
      .toSorted((a, b) => a.packageName.localeCompare(b.packageName))
      .map((release) => ({
        packageName: release.packageName,
        nextVersion: release.nextVersion,
        currentVersion: release.currentVersion,
        bump: release.bump,
        dependsOn: release.dependsOn.toSorted(),
        commits: release.commits.map((commit) => ({
          hash: commit.hash,
          type: commit.type,
          breaking: commit.breaking,
        })),
      })),
  })
