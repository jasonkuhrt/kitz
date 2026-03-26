import { Schema } from 'effect'

// Has make and is but missing codec statics
export class Warn extends Schema.TaggedClass<Warn>()('Warn', {}) {
  static make = this.makeUnsafe
  static is = Schema.is(Warn)
}
