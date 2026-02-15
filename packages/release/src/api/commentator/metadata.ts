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

const PLAN_MARKER = '<!-- kitz-release-plan -->'
const HEAD_SHA_RE = /<!-- head-sha:(\S+) -->/
const PUBLISH_STATE_RE = /<!-- publish-state:(\S+) -->/
const PUBLISH_HISTORY_RE = /<!-- kitz-release-publish-history\n([\s\S]*?)\n-->/

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

  const shaMatch = body.match(HEAD_SHA_RE)
  const stateMatch = body.match(PUBLISH_STATE_RE)
  const historyMatch = body.match(PUBLISH_HISTORY_RE)

  const headSha = shaMatch?.[1] ?? ''
  const publishState = parsePublishState(stateMatch?.[1])

  let publishHistory: PublishRecord[] = []
  if (historyMatch?.[1]) {
    try {
      const parsed = JSON.parse(historyMatch[1])
      if (parsed?.publishes && Array.isArray(parsed.publishes)) {
        publishHistory = parsed.publishes
      }
    } catch {
      // Malformed JSON — treat as empty history
    }
  }

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
    JSON.stringify({ publishes: metadata.publishHistory }),
    `-->`,
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_STATES: readonly PublishState[] = ['idle', 'publishing', 'published', 'failed']

const parsePublishState = (value: string | undefined): PublishState => {
  if (value && (VALID_STATES as readonly string[]).includes(value)) {
    return value as PublishState
  }
  return 'idle'
}
