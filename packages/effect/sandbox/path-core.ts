/** Statics.Codec — a combinator you EXTEND that bakes in the codec statics, while
 *  the class body still adds bespoke ones. Generalizes asClassPath. */
import { Schema as S, SchemaGetter } from 'effect'
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

class Val extends S.TaggedClass<Val>()('Val', { x: S.String }) {}
const codec = S.String.pipe(
  S.decodeTo(Val, {
    decode: SchemaGetter.transform((s) => new Val({ x: s })),
    encode: SchemaGetter.transform((v) => v.x),
  }),
)

// THE COMBINATOR — statics bound to `base` (clean: the Codec<…,string,never,never>
// constraint keeps decodeSync/encodeSync service-free). One cast: asClass is newable.
const Codec = <B extends S.Codec<unknown, string, never, never>>(base: B) => {
  const Base = base as B & (new (_: never) => {})
  return class extends Base {
    static is = S.is(base)
    static fromString = (input: string): B['Type'] => S.decodeSync(base)(input)
    static encodeSync = S.encodeSync(base)
    static decodeSync = S.decodeSync(base)
  }
}

// usage exactly like your proposal: extend it + add bespoke statics in the body
class Thing_ extends Codec(S.asClass(codec)) {
  static custom = (t: Val): string => `<${t.x}>`
}
const Thing = Thing_
type Thing = typeof Thing_.Type

const _typeOk: Equal<Thing, Val> = true
const _guard: (u: unknown) => boolean = Thing.is
const parsed = Thing.fromString('hello') // baked-in static
const round = Thing.encodeSync(parsed) // baked-in static
const bespoke = Thing.custom(parsed) // body static, fully typed
console.log(
  'proofs:',
  _typeOk,
  '| fromString→',
  parsed.x,
  '| encodeSync→',
  round,
  '| custom→',
  bespoke,
)
