import { Order, Schema } from 'effect'

// Has order but missing derived utilities
export class Version extends Schema.TaggedClass<Version>()('Version', {
  major: Schema.Number,
}) {
  static make = this.makeUnsafe
  static is = Schema.is(Version)
  static decode = Schema.decode(Version)
  static decodeSync = Schema.decodeSync(Version)
  static encode = Schema.encode(Version)
  static encodeSync = Schema.encodeSync(Version)
  static equivalence = Schema.equivalence(Version)
  static order: Order.Order<Version> = Order.mapInput(Order.number, (v: Version) => v.major)
}
