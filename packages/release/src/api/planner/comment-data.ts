import { Env } from '@kitz/env'
import { Git } from '@kitz/git'
import { Semver } from '@kitz/semver'
import { Effect, Option, Schema as S } from 'effect'
import type { ReleaseCommit } from '../analyzer/commit.js'
import type { Impact } from '../analyzer/models/__.js'
import { ExplorerError } from '../explorer/errors.js'
import { resolveReleaseTarget } from '../explorer/explore.js'
import type { Item } from './models/item.js'
import { ItemSchema } from './models/item.js'
import type { Plan } from './models/plan.js'
import { calculateNextVersion } from './version.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubContext {
  readonly owner: string
  readonly repo: string
  readonly branch: string
  readonly headSha: string
  readonly prNumber: number
}

export interface CommitDisplay {
  readonly shortSha: string
  readonly subject: string
  readonly type: string
  readonly breaking: boolean
  readonly commitUrl: string
}

export interface StableProjection {
  readonly version: Semver.Semver
  readonly bump: Semver.BumpType
  readonly current: Option.Option<Semver.Semver>
}

export interface PublishRecord {
  readonly package: string
  readonly version: string
  readonly iteration: number
  readonly sha: string
  readonly timestamp: string
  readonly runId: string
}

export interface EnrichedRelease {
  readonly item: Item
  readonly commits: readonly CommitDisplay[]
  readonly stableProjection: StableProjection | null
  readonly publishedVersions: readonly PublishRecord[]
  readonly sourceUrl: string
}

export interface EnrichedCascade {
  readonly item: Item
  readonly via: readonly string[]
  readonly sourceUrl: string
}

export interface CommentData {
  readonly planType: Plan['type']
  readonly github: GitHubContext
  readonly releases: readonly EnrichedRelease[]
  readonly cascades: readonly EnrichedCascade[]
}

// ---------------------------------------------------------------------------
// resolveGitHubContext
// ---------------------------------------------------------------------------

/**
 * Resolve GitHub context for comment rendering.
 *
 * Lighter than `Explorer.explore()` — only resolves owner/repo/branch/sha,
 * does NOT require GITHUB_TOKEN credentials.
 */
export const resolveGitHubContext = (
  prNumber: number,
): Effect.Effect<GitHubContext, ExplorerError | Git.GitError | Git.GitParseError, Git.Git | Env.Env> =>
  Effect.gen(function*() {
    const env = yield* Env.Env
    const git = yield* Git.Git
    const target = yield* resolveReleaseTarget(env.vars)
    const headSha = yield* git.getHeadSha()
    const branch = yield* git.getCurrentBranch()

    return {
      owner: target.owner,
      repo: target.repo,
      branch,
      headSha,
      prNumber,
    }
  })

// ---------------------------------------------------------------------------
// enrichPlan
// ---------------------------------------------------------------------------

/**
 * Project a Plan (with embedded Analysis) into rendering-ready CommentData.
 *
 * Pure function — all inputs must be pre-resolved.
 */
export const enrichPlan = (
  plan: Plan,
  context: {
    readonly github: GitHubContext
    readonly publishHistory: readonly PublishRecord[]
  },
): CommentData => {
  const { github, publishHistory } = context
  const analysis = plan.analysis
  const baseUrl = `https://github.com/${github.owner}/${github.repo}`

  const releases = plan.releases.map((item): EnrichedRelease => {
    const impact = analysis?.impacts.find((i) => i.package.name.moniker === item.package.name.moniker)
    return {
      item,
      commits: buildCommitDisplays(item, impact, baseUrl),
      stableProjection: buildStableProjection(impact),
      publishedVersions: publishHistory.filter((p) => p.package === item.package.name.moniker),
      sourceUrl: `${baseUrl}/tree/${github.branch}/packages/${item.package.scope}`,
    }
  })

  const cascades = plan.cascades.map((item): EnrichedCascade => {
    const cascadeImpact = analysis?.cascades.find((c) => c.package.name.moniker === item.package.name.moniker)
    return {
      item,
      via: cascadeImpact?.triggeredBy.map((pkg) => pkg.name.moniker) ?? [],
      sourceUrl: `${baseUrl}/tree/${github.branch}/packages/${item.package.scope}`,
    }
  })

  return { planType: plan.type, github, releases, cascades }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildCommitDisplays = (
  item: Item,
  impact: Impact | undefined,
  baseUrl: string,
): CommitDisplay[] => {
  const commits = impact?.commits ?? item.commits
  return commits.map((commit: ReleaseCommit) => {
    const scoped = commit.forScope(item.package.scope)
    const shortSha = scoped.hash.slice(0, 7)
    return {
      shortSha,
      subject: scoped.description,
      type: scoped.type,
      breaking: scoped.breaking,
      commitUrl: `${baseUrl}/commit/${scoped.hash}`,
    }
  })
}

const buildStableProjection = (impact: Impact | undefined): StableProjection | null => {
  if (!impact) return null
  return {
    version: calculateNextVersion(impact.currentVersion, impact.bump),
    bump: impact.bump,
    current: impact.currentVersion,
  }
}

// ---------------------------------------------------------------------------
// Schemas (for JSON serialization/deserialization)
// ---------------------------------------------------------------------------

const GitHubContextSchema = S.Struct({
  owner: S.String,
  repo: S.String,
  branch: S.String,
  headSha: S.String,
  prNumber: S.Number,
})

const CommitDisplaySchema = S.Struct({
  shortSha: S.String,
  subject: S.String,
  type: S.String,
  breaking: S.Boolean,
  commitUrl: S.String,
})

const PublishRecordSchema = S.Struct({
  package: S.String,
  version: S.String,
  iteration: S.Number,
  sha: S.String,
  timestamp: S.String,
  runId: S.String,
})

const StableProjectionSchema = S.Struct({
  version: Semver.Schema,
  bump: Semver.BumpType,
  current: S.OptionFromNullOr(Semver.Schema),
})

const EnrichedReleaseSchema = S.Struct({
  item: ItemSchema,
  commits: S.Array(CommitDisplaySchema),
  stableProjection: S.NullOr(StableProjectionSchema),
  publishedVersions: S.Array(PublishRecordSchema),
  sourceUrl: S.String,
})

const EnrichedCascadeSchema = S.Struct({
  item: ItemSchema,
  via: S.Array(S.String),
  sourceUrl: S.String,
})

export const CommentDataSchema = S.Struct({
  planType: S.Literal('stable', 'preview', 'pr'),
  github: GitHubContextSchema,
  releases: S.Array(EnrichedReleaseSchema),
  cascades: S.Array(EnrichedCascadeSchema),
})

export const serializeCommentData = (data: CommentData): unknown => S.encodeSync(CommentDataSchema)(data)

export const deserializeCommentData = (json: unknown): CommentData => S.decodeUnknownSync(CommentDataSchema)(json)
