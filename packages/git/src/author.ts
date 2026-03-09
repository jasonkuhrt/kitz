import { Schema } from 'effect'

/**
 * A git commit author.
 */
export class Author extends Schema.TaggedClass<Author>()('Author', {
  name: Schema.String,
  email: Schema.String,
}) {}
