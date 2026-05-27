import { Schema } from 'effect'

class Error extends Schema.TaggedClass<Error>()('Error', {}) {
  static is = Schema.is(Error)
}

class Warn extends Schema.TaggedClass<Warn>()('Warn', {}) {
  static is = Schema.is(Warn)
}

// Missing companion type
export const Severity = Schema.Union([Error, Warn]).pipe(Schema.toTaggedUnion('_tag'))
