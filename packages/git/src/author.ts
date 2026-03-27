import { Schema } from 'effect'

/**
 * A git commit author.
 */
export class Author extends Schema.TaggedClass<Author>()('Author', {
  name: Schema.String,
  email: Schema.String,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Author)
  static decode = Schema.decodeUnknownEffect(Author)
  static decodeSync = Schema.decodeUnknownSync(Author)
  static encode = Schema.encodeUnknownEffect(Author)
  static encodeSync = Schema.encodeUnknownSync(Author)
  static equivalence = Schema.toEquivalence(Author)
  static ordered = false as const
}
