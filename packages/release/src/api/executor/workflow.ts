/**
 * @module executor/workflow
 *
 * Declarative DAG definition for the release workflow using @kitz/flo.
 *
 * Graph structure:
 * ```
 * Prepare:A ---+--> Publish:A --> VerifyPublish:A --> CreateTag:A --> PushTag:A --> CreateGHRelease:A
 * Prepare:B ---+--> Publish:B --> VerifyPublish:B --> CreateTag:B --> PushTag:B --> CreateGHRelease:B
 * Prepare:C ---+--> Publish:C --> VerifyPublish:C --> CreateTag:C --> PushTag:C --> CreateGHRelease:C
 * ```
 */

import { Flo } from '@kitz/flo'
import { resolvePublishSemantics } from '../publishing.js'
import { ExecutorError as ExecutorErrorSchema } from './errors.js'
import { createGithubRelease } from './workflow/activities/github.js'
import { createTag, pushTag, pushTagsAtomic } from './workflow/activities/git.js'
import { prepareRelease } from './workflow/activities/prepare.js'
import { publishRelease } from './workflow/activities/publish.js'
import { verifyPublishedRelease } from './workflow/activities/verify.js'
import { releaseWorkflowIdempotencyKey } from './workflow/idempotency.js'
import { ReleasePayload } from './workflow/payload.js'
import { resolvePayloadPrNumber } from './workflow/pr-number.js'
import { tagForRelease, toReleaseInfo } from './workflow/release-info.js'

export {
  CommitEntrySchema,
  ReleasePayload,
  ReleaseSchema,
  type ReleasePayloadType,
} from './workflow/payload.js'
export { formatTag, toReleaseInfo } from './workflow/release-info.js'

/**
 * The main release workflow using declarative DAG execution.
 *
 * - Fresh-run preflight happens outside the durable workflow
 * - The DAG is executed single-flight within each layer for clean suspension/resume
 * - Publish starts only after every Prepare completes successfully
 * - Publish ordering respects local package dependency edges from the payload
 * - Each CreateTag runs after its corresponding Publish
 * - Each PushTag runs after its corresponding CreateTag
 * - Each CreateGHRelease runs after its corresponding PushTag
 */
export const ReleaseWorkflow = Flo.Workflow.make({
  name: 'ReleaseWorkflow',
  payload: ReleasePayload,
  error: ExecutorErrorSchema,
  idempotencyKey: releaseWorkflowIdempotencyKey,
  layerConcurrency: 1,

  graph: (payload, node) => {
    const prNumber = resolvePayloadPrNumber(payload)
    const publishSemantics =
      payload.options.lifecycle !== undefined
        ? resolvePublishSemantics({
            lifecycle: payload.options.lifecycle,
            ...(payload.options.publishing !== undefined
              ? { publishing: payload.options.publishing }
              : {}),
            ...(payload.options.tag !== undefined ? { tag: payload.options.tag } : {}),
            ...(prNumber !== undefined ? { prNumber } : {}),
          })
        : undefined
    const plannedReleases = payload.releases.map(toReleaseInfo)

    const prepares = payload.releases.map((release) =>
      node(
        `Prepare:${release.packageName}`,
        prepareRelease({
          payload,
          plannedReleases,
          release,
        }),
        {},
      ),
    )

    const publishHandles: Array<{
      readonly packageName: string
      readonly handle: Flo.Workflow.NodeHandle<string>
    }> = []

    const publishes = payload.releases.map((release) => {
      const dependencies = release.dependsOn
        .map(
          (dependencyName) =>
            publishHandles.find((entry) => entry.packageName === dependencyName)?.handle,
        )
        .filter(
          (dependency): dependency is Flo.Workflow.NodeHandle<string> => dependency !== undefined,
        )
      const after = [...prepares, ...dependencies]
      const publishTag = publishSemantics?.distTag ?? payload.options.tag

      const handle = node(
        `Publish:${release.packageName}`,
        publishRelease({
          payload,
          publishTag,
          release,
        }),
        after.length > 0 ? { after } : undefined,
      )

      publishHandles.push({ packageName: release.packageName, handle })
      return handle
    })

    const verifyPublishes = payload.releases.map((release, i) =>
      node(
        `VerifyPublish:${release.packageName}`,
        verifyPublishedRelease({
          payload,
          publishTag: publishSemantics?.distTag ?? payload.options.tag,
          release,
        }),
        { after: publishes[i]! },
      ),
    )

    const createTags = payload.releases.map((release, i) => {
      const tag = tagForRelease(release)
      return node(
        `CreateTag:${tag}`,
        createTag({
          payload,
          tag,
        }),
        { after: verifyPublishes[i]! },
      )
    })

    const shouldAtomicPushTags =
      payload.options.atomicTagPush && payload.releases.length > 1 && !payload.options.dryRun
    const atomicPushTagHandle = shouldAtomicPushTags
      ? node(
          `PushTagsAtomic:${payload.releases.length}`,
          pushTagsAtomic({
            payload,
            tags: payload.releases.map(tagForRelease),
          }),
          { after: createTags },
        )
      : undefined

    const pushTags = payload.releases.map((release, i) => {
      const tag = tagForRelease(release)
      if (atomicPushTagHandle !== undefined) return atomicPushTagHandle

      return node(
        `PushTag:${tag}`,
        pushTag({
          payload,
          tag,
          force:
            publishSemantics?.forcePushTag ??
            (payload.options.lifecycle === undefined && payload.options.tag === 'next'),
        }),
        { after: createTags[i]! },
      )
    })

    const createGHReleases = payload.releases.map((release, i) =>
      node(
        `CreateGHRelease:${tagForRelease(release)}`,
        createGithubRelease({
          payload,
          publishSemantics,
          release,
        }),
        { after: pushTags[i]! },
      ),
    )

    return {
      publishes,
      verifyPublishes,
      createTags,
      pushTags,
      createGHReleases,
    }
  },
})
