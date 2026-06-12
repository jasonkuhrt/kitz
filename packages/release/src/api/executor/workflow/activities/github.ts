import { ConventionalCommits } from '@kitz/conventional-commits'
import { Github } from '@kitz/github'
import { Semver } from '@kitz/semver'
import { Effect } from 'effect'
import * as Notes from '../../../notes/__.js'
import {
  formatGithubReleaseTitle,
  resolvePublishSemantics,
  type PublishSemantics,
} from '../../../publishing.js'
import { ExecutorGHReleaseError, mapToExecutorError } from '../../errors.js'
import type { ReleasePayloadType } from '../payload.js'
import { type ReleasePayloadEntry, tagForRelease } from '../release-info.js'
import { recordSideEffect } from '../side-effects.js'

const legacyCandidateSemantics = (distTag: string) =>
  resolvePublishSemantics({
    lifecycle: 'candidate',
    tag: distTag,
  })

export const createGithubRelease = (params: {
  readonly payload: ReleasePayloadType
  readonly publishSemantics: PublishSemantics | undefined
  readonly release: ReleasePayloadEntry
}) =>
  Effect.gen(function* () {
    const nextVersion = Semver.fromString(params.release.nextVersion)
    const tag = tagForRelease(params.release)
    const legacyCandidateDistTag =
      params.payload.options.lifecycle === undefined && params.payload.options.tag === 'next'
        ? 'next'
        : undefined
    const isPrereleaseVersion = Semver.getPrerelease(nextVersion) !== undefined

    if (params.payload.options.dryRun) {
      yield* Effect.log(`[dry-run] Would create GH release: ${tag}`)
      return tag
    }

    yield* Effect.log(`Creating GH release: ${tag}`)

    const changelog = Notes.format({
      scope: params.release.packageName,
      commits: params.release.commits.map((c) => ({
        ...c,
        type: ConventionalCommits.Type.parse(c.type),
      })),
      newVersion: params.release.nextVersion,
    })

    const gh = yield* Github.Github

    if (
      params.publishSemantics?.githubReleaseStyle === 'dist-tagged' ||
      legacyCandidateDistTag !== undefined
    ) {
      const distTag = params.publishSemantics?.distTag ?? legacyCandidateDistTag!
      const title = formatGithubReleaseTitle(
        params.publishSemantics ?? legacyCandidateSemantics(distTag),
        {
          packageName: params.release.packageName,
          version: params.release.nextVersion,
        },
      )
      const exists = yield* gh.releaseExists(tag)

      if (exists) {
        yield* Effect.log(`Updating existing candidate release: ${tag}`)
        yield* recordSideEffect({
          payload: params.payload,
          kind: 'github-release-update',
          subject: tag,
          planned: { tag, title, prerelease: true },
          effect: gh.updateRelease(tag, { title, body: changelog.markdown }).pipe(Effect.as(tag)),
        })
      } else {
        yield* recordSideEffect({
          payload: params.payload,
          kind: 'github-release-create',
          subject: tag,
          planned: { tag, title, prerelease: true },
          effect: gh
            .createRelease({
              tag,
              title,
              body: changelog.markdown,
              prerelease: true,
            })
            .pipe(Effect.as(tag)),
        })
      }
    } else {
      const releaseSemantics =
        params.publishSemantics ??
        resolvePublishSemantics({
          lifecycle: isPrereleaseVersion ? 'ephemeral' : 'official',
          ...(params.payload.options.tag !== undefined ? { tag: params.payload.options.tag } : {}),
        })
      const title = formatGithubReleaseTitle(releaseSemantics, {
        packageName: params.release.packageName,
        version: params.release.nextVersion,
      })
      const prerelease = releaseSemantics.prerelease || isPrereleaseVersion
      yield* recordSideEffect({
        payload: params.payload,
        kind: 'github-release-create',
        subject: tag,
        planned: { tag, title, prerelease },
        effect: gh
          .createRelease({
            tag,
            title,
            body: changelog.markdown,
            ...(prerelease ? { prerelease: true } : {}),
          })
          .pipe(Effect.as(tag)),
      })
    }

    return tag
  }).pipe(
    mapToExecutorError(
      (detail) =>
        new ExecutorGHReleaseError({ context: { tag: tagForRelease(params.release), detail } }),
    ),
  )
