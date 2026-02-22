import { Schema } from 'effect'

/** Location within a PR title. */
export class PrTitle extends Schema.TaggedClass<PrTitle>()('ViolationLocationPrTitle', {
  /** The PR title text. */
  title: Schema.String,
}) {
  static is = Schema.is(PrTitle)
}

/** Location within a PR body. */
export class PrBody extends Schema.TaggedClass<PrBody>()('ViolationLocationPrBody', {
  /** Line number in the body (if applicable). */
  line: Schema.optional(Schema.Number),
}) {
  static is = Schema.is(PrBody)
}

/** Location at repository settings level. */
export class RepoSettings extends Schema.TaggedClass<RepoSettings>()('ViolationLocationRepoSettings', {}) {
  static is = Schema.is(RepoSettings)
}

/** Location in git history. */
export class GitHistory extends Schema.TaggedClass<GitHistory>()('ViolationLocationGitHistory', {
  /** Commit SHA where violation occurred. */
  sha: Schema.String,
}) {
  static is = Schema.is(GitHistory)
}

/** Location within a file. */
export class File extends Schema.TaggedClass<File>()('ViolationLocationFile', {
  /** File path relative to repo root. */
  path: Schema.String,
  /** Line number (if applicable). */
  line: Schema.optional(Schema.Number),
}) {
  static is = Schema.is(File)
}

/** Location in environment/system state (npm auth, git working dir, etc). */
export class Environment extends Schema.TaggedClass<Environment>()('ViolationLocationEnvironment', {
  /** Human-readable description of the environment issue. */
  message: Schema.String,
}) {
  static is = Schema.is(Environment)
}

/** Where a lint violation occurred. */
export type ViolationLocation = PrTitle | PrBody | RepoSettings | GitHistory | File | Environment

export const ViolationLocation = Schema.Union(PrTitle, PrBody, RepoSettings, GitHistory, File, Environment)
