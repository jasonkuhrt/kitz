import { Schema as S } from 'effect'

export class Scoped extends S.TaggedClass<Scoped>()('Scoped', {
  scope: S.String,
  name: S.String,
}) {
  static make = this.makeUnsafe
  static is = S.is(Scoped)
  static decode = S.decode(Scoped)
  static decodeSync = S.decodeSync(Scoped)
  static encode = S.encode(Scoped)
  static encodeSync = S.encodeSync(Scoped)
  static equivalence = S.equivalence(Scoped)

  get moniker(): string {
    return `@${this.scope}/${this.name}`
  }
}
