import { Sch } from '@kitz/sch'
import { Schema } from 'effect'

/**
 * A git commit author.
 */
export class Author extends Sch.TaggedClass<Author>()('Author', {
  name: Schema.String,
  email: Schema.String,
}) {}
