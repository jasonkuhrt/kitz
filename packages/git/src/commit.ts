import { Schema } from 'effect'
import { Author } from './author.js'
import { Sha } from './sha.js'

/**
 * A commit from git log.
 *
 * The `message` field contains the full raw commit message (subject + body).
 * Use a parser like ConventionalCommits to extract structure from it.
 */
export class Commit extends Schema.TaggedClass<Commit>()('Commit', {
  hash: Sha,
  /** Full raw commit message (subject line + body) */
  message: Schema.String,
  author: Author,
  date: Schema.Date,
}) {}

/**
 * Fields type for ParsedCommit with the message field replaced by a parsed schema.
 */
type ParsedCommitFields<P extends Schema.Schema.Any> = Omit<(typeof Commit)['fields'], '_tag' | 'message'> & {
  readonly message: P
}

/**
 * Base commit fields without _tag (for extension).
 */
const baseFields = {
  hash: Commit.fields.hash,
  author: Commit.fields.author,
  date: Commit.fields.date,
}

/**
 * Factory to create a commit schema with a parsed message field.
 *
 * Reuses {@link Commit.fields} and replaces the `message` field with the
 * provided parsed schema. This keeps the base commit structure as the
 * single source of truth.
 *
 * @example
 * ```ts
 * import { Git } from '@kitz/git'
 * import { ConventionalCommits } from '@kitz/conventional-commits'
 *
 * // Create a commit type with parsed CC message
 * class ReleaseCommit extends Git.ParsedCommit<ReleaseCommit>()('ReleaseCommit', ConventionalCommits.Commit.Commit) {}
 *
 * const commit: ReleaseCommit = ...
 * commit.message // ← ConventionalCommits.Commit.Commit (not string)
 * ```
 */
export const ParsedCommit = <Self = never>(identifier?: string) =>
<Tag extends string, P extends Schema.Schema.Any>(
  tag: Tag,
  parsedSchema: P,
): Schema.TaggedClass<Self, Tag, { readonly _tag: Schema.tag<Tag> } & ParsedCommitFields<P>> =>
  Schema.TaggedClass<Self>(identifier)(tag, {
    ...baseFields,
    message: parsedSchema,
  }) as any
