import { Schema } from 'effect'

// Has is but missing codec statics
export class Warn extends Schema.TaggedClass<Warn>()('Warn', {}) {
  static is = Schema.is(Warn)
}
