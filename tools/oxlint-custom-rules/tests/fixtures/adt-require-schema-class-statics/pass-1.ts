import { Schema } from 'effect'

export class Error extends Schema.TaggedClass<Error>()('Error', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(Error)
  static decode = Schema.decode(Error)
  static decodeSync = Schema.decodeSync(Error)
  static encode = Schema.encode(Error)
  static encodeSync = Schema.encodeSync(Error)
  static equivalence = Schema.equivalence(Error)
}
