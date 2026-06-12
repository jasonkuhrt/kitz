import { Sch } from '@kitz/sch'
import { Schema } from 'effect'

/** Location within a PR title. */
export class PrTitle extends Sch.TaggedClass<PrTitle>()('ViolationLocationPrTitle', {
  /** The PR title text. */
  title: Schema.String,
}) {}

/** Location within a PR body. */
export class PrBody extends Sch.TaggedClass<PrBody>()('ViolationLocationPrBody', {
  /** Line number in the body (if applicable). */
  line: Schema.optional(Schema.Number),
}) {}

/** Location at repository settings level. */
export class RepoSettings extends Sch.TaggedClass<RepoSettings>()(
  'ViolationLocationRepoSettings',
  {},
) {}

/** Location in git history. */
export class GitHistory extends Sch.TaggedClass<GitHistory>()('ViolationLocationGitHistory', {
  /** Commit SHA where violation occurred. */
  sha: Schema.String,
}) {}

/** Location within a file. */
export class File extends Sch.TaggedClass<File>()('ViolationLocationFile', {
  /** File path relative to repo root. */
  path: Schema.String,
  /** Line number (if applicable). */
  line: Schema.optional(Schema.Number),
}) {}

/** Location in environment/system state (npm auth, git working dir, etc). */
export class Environment extends Sch.TaggedClass<Environment>()('ViolationLocationEnvironment', {
  /** Human-readable description of the environment issue. */
  message: Schema.String,
}) {}

/** Where a lint violation occurred. */
export type ViolationLocation = PrTitle | PrBody | RepoSettings | GitHistory | File | Environment

export const ViolationLocation = Schema.Union([
  PrTitle,
  PrBody,
  RepoSettings,
  GitHistory,
  File,
  Environment,
]).pipe(Schema.toTaggedUnion('_tag'))

export namespace ViolationLocation {
  export type PrTitle = import('./violation-location.js').PrTitle
  export type PrBody = import('./violation-location.js').PrBody
  export type RepoSettings = import('./violation-location.js').RepoSettings
  export type GitHistory = import('./violation-location.js').GitHistory
  export type File = import('./violation-location.js').File
  export type Environment = import('./violation-location.js').Environment
}
