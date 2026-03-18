import { Effect, Option, Schema, SchemaGetter, SchemaIssue } from 'effect'
import { Author } from './author.js'
import { Sha } from './sha.js'

const CommitDateIsoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const CommitDate = Schema.String.pipe(
  Schema.decodeTo(Schema.Date, {
    decode: SchemaGetter.transformOrFail((value) => {
      if (!CommitDateIsoPattern.test(value)) {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(value), {
            message: 'Invalid commit date format: expected canonical ISO 8601 UTC string',
          }),
        )
      }

      const date = new Date(value)
      if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(value), {
            message: 'Invalid ISO date string',
          }),
        )
      }
      return Effect.succeed(date)
    }),
    encode: SchemaGetter.transformOrFail((value) => {
      if (Number.isNaN(value.getTime())) {
        return Effect.fail(
          new SchemaIssue.InvalidValue(Option.some(value), {
            message: 'Invalid Date value',
          }),
        )
      }
      return Effect.succeed(value.toISOString())
    }),
  }),
)

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
  date: CommitDate,
}) {
  static is = Schema.is(Commit)
  static decode = Schema.decodeUnknownEffect(Commit)
  static decodeSync = Schema.decodeUnknownSync(Commit)
  static encode = Schema.encodeUnknownEffect(Commit)
  static encodeSync = Schema.encodeUnknownSync(Commit)
  static equivalence = Schema.toEquivalence(Commit)
  static ordered = false as const
  static make = this.makeUnsafe
}

/**
 * Fields type for ParsedCommit with the message field replaced by a parsed schema.
 */
type ParsedCommitFields<P extends Schema.Top> = Omit<
  (typeof Commit)['fields'],
  '_tag' | 'message'
> & {
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
export const ParsedCommit =
  <Self = never>(identifier?: string) =>
  <Tag extends string, P extends Schema.Top>(tag: Tag, parsedSchema: P) =>
    Schema.TaggedClass<Self>(identifier)(tag, {
      hash: baseFields.hash,
      author: baseFields.author,
      date: baseFields.date,
      message: parsedSchema,
    })
