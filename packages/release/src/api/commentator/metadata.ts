import { Option, Schema as S } from 'effect'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PublishState = 'idle' | 'publishing' | 'published' | 'failed'

export interface PublishRecord {
  readonly package: string
  readonly version: string
  readonly iteration: number
  readonly sha: string
  readonly timestamp: string
  readonly runId: string
}

export interface Metadata {
  readonly headSha: string
  readonly publishState: PublishState
  readonly publishHistory: readonly PublishRecord[]
}

// ---------------------------------------------------------------------------
// Markers
// ---------------------------------------------------------------------------

export const PLAN_MARKER = '<!-- kitz-release-plan -->'
const HEAD_SHA_RE = /<!-- head-sha:(\S+) -->/
const PUBLISH_STATE_RE = /<!-- publish-state:(\S+) -->/
const PUBLISH_HISTORY_RE = /<!-- kitz-release-publish-history\n([\s\S]*?)\n-->/

export const PublishStateSchema = S.Literal('idle', 'publishing', 'published', 'failed')
export const PublishRecordSchema = S.Struct({
  package: S.String,
  version: S.String,
  iteration: S.Number,
  sha: S.String,
  timestamp: S.String,
  runId: S.String,
})
export const PublishHistoryEnvelope = S.Struct({
  publishes: S.Array(PublishRecordSchema),
})
export const PublishHistoryJson = S.parseJson(PublishHistoryEnvelope)

const decodePublishState = S.decodeUnknownOption(PublishStateSchema)
const decodePublishHistory = S.decodeUnknownOption(PublishHistoryJson)
const encodePublishHistory = S.encodeSync(PublishHistoryJson)

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Extract metadata from a PR comment body.
 *
 * Returns `null` if the body does not contain the release plan marker.
 */
export const parseMetadata = (body: string): Metadata | null => {
  if (!body.includes(PLAN_MARKER)) return null

  const headSha = getCapture(HEAD_SHA_RE)(body).pipe(Option.getOrElse(() => ''))
  const publishState = getCapture(PUBLISH_STATE_RE)(body).pipe(
    Option.flatMap(decodePublishState),
    Option.getOrElse((): PublishState => 'idle'),
  )
  const publishHistory = getCapture(PUBLISH_HISTORY_RE)(body).pipe(
    Option.flatMap(decodePublishHistory),
    Option.map((history) => history.publishes),
    Option.getOrElse((): readonly PublishRecord[] => []),
  )

  return { headSha, publishState, publishHistory }
}

/**
 * Extract just the publish history from a comment body.
 *
 * Convenience function for workflows that only need the history
 * (e.g., preserving history across comment regeneration).
 */
export const parsePublishHistory = (body: string): readonly PublishRecord[] => {
  return parseMetadata(body)?.publishHistory ?? []
}

// ---------------------------------------------------------------------------
// Embed
// ---------------------------------------------------------------------------

/**
 * Generate the metadata HTML comment block for embedding in a comment body.
 */
export const renderMetadataBlock = (metadata: Metadata): string => {
  const lines = [
    PLAN_MARKER,
    `<!-- head-sha:${metadata.headSha} -->`,
    `<!-- publish-state:${metadata.publishState} -->`,
    `<!-- kitz-release-publish-history`,
    encodePublishHistory({ publishes: metadata.publishHistory }),
    `-->`,
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getCapture =
  (regex: RegExp) =>
  (input: string): Option.Option<string> =>
    Option.fromNullable(input.match(regex)?.[1])
