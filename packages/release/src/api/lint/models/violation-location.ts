import { Schema } from 'effect'

/** Location within a PR title. */
export class PrTitle extends Schema.TaggedClass<PrTitle>()('ViolationLocationPrTitle', {
  /** The PR title text. */
  title: Schema.String,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(PrTitle)
  static decode = Schema.decodeUnknownEffect(PrTitle)
  static decodeSync = Schema.decodeUnknownSync(PrTitle)
  static encode = Schema.encodeUnknownEffect(PrTitle)
  static encodeSync = Schema.encodeUnknownSync(PrTitle)
  static equivalence = Schema.toEquivalence(PrTitle)
  static ordered = false as const
}

/** Location within a PR body. */
export class PrBody extends Schema.TaggedClass<PrBody>()('ViolationLocationPrBody', {
  /** Line number in the body (if applicable). */
  line: Schema.optional(Schema.Number),
}) {
  static make = this.makeUnsafe
  static is = Schema.is(PrBody)
  static decode = Schema.decodeUnknownEffect(PrBody)
  static decodeSync = Schema.decodeUnknownSync(PrBody)
  static encode = Schema.encodeUnknownEffect(PrBody)
  static encodeSync = Schema.encodeUnknownSync(PrBody)
  static equivalence = Schema.toEquivalence(PrBody)
  static ordered = false as const
}

/** Location at repository settings level. */
export class RepoSettings extends Schema.TaggedClass<RepoSettings>()(
  'ViolationLocationRepoSettings',
  {},
) {
  static make = this.makeUnsafe
  static is = Schema.is(RepoSettings)
  static decode = Schema.decodeUnknownEffect(RepoSettings)
  static decodeSync = Schema.decodeUnknownSync(RepoSettings)
  static encode = Schema.encodeUnknownEffect(RepoSettings)
  static encodeSync = Schema.encodeUnknownSync(RepoSettings)
  static equivalence = Schema.toEquivalence(RepoSettings)
  static ordered = false as const
}

/** Location in git history. */
export class GitHistory extends Schema.TaggedClass<GitHistory>()('ViolationLocationGitHistory', {
  /** Commit SHA where violation occurred. */
  sha: Schema.String,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(GitHistory)
  static decode = Schema.decodeUnknownEffect(GitHistory)
  static decodeSync = Schema.decodeUnknownSync(GitHistory)
  static encode = Schema.encodeUnknownEffect(GitHistory)
  static encodeSync = Schema.encodeUnknownSync(GitHistory)
  static equivalence = Schema.toEquivalence(GitHistory)
  static ordered = false as const
}

/** Location within a file. */
export class File extends Schema.TaggedClass<File>()('ViolationLocationFile', {
  /** File path relative to repo root. */
  path: Schema.String,
  /** Line number (if applicable). */
  line: Schema.optional(Schema.Number),
}) {
  static make = this.makeUnsafe
  static is = Schema.is(File)
  static decode = Schema.decodeUnknownEffect(File)
  static decodeSync = Schema.decodeUnknownSync(File)
  static encode = Schema.encodeUnknownEffect(File)
  static encodeSync = Schema.encodeUnknownSync(File)
  static equivalence = Schema.toEquivalence(File)
  static ordered = false as const
}

/** Location in environment/system state (npm auth, git working dir, etc). */
export class Environment extends Schema.TaggedClass<Environment>()('ViolationLocationEnvironment', {
  /** Human-readable description of the environment issue. */
  message: Schema.String,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Environment)
  static decode = Schema.decodeUnknownEffect(Environment)
  static decodeSync = Schema.decodeUnknownSync(Environment)
  static encode = Schema.encodeUnknownEffect(Environment)
  static encodeSync = Schema.encodeUnknownSync(Environment)
  static equivalence = Schema.toEquivalence(Environment)
  static ordered = false as const
}

/** Where a lint violation occurred. */
export type ViolationLocation = PrTitle | PrBody | RepoSettings | GitHistory | File | Environment

export const ViolationLocation = Schema.Union([
  PrTitle,
  PrBody,
  RepoSettings,
  GitHistory,
  File,
  Environment,
])
