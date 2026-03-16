import { Schema } from 'effect'

class Error extends Schema.TaggedClass<Error>()('Error', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(Error)
}

class Warn extends Schema.TaggedClass<Warn>()('Warn', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(Warn)
}

// Missing companion type
export const Severity = Schema.Union([Error, Warn]).pipe(Schema.toTaggedUnion('_tag'))
