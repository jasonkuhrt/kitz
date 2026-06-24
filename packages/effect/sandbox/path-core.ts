/** asClassPath: wrap a path codec + bake in the shared statics (is, fromString),
 *  correctly bound per class. The factory the idea "shifts" to. */
import { Schema as S, SchemaGetter } from 'effect'
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

class RelDirVal extends S.TaggedClass<RelDirVal>()('RelDir', { segments: S.Array(S.String) }) {}
const relDirCodec = S.String.pipe(
  S.decodeTo(RelDirVal, {
    decode: SchemaGetter.transform(
      (s) => new RelDirVal({ segments: s.split('/').filter(Boolean) }),
    ),
    encode: SchemaGetter.transform((v) => v.segments.join('/')),
  }),
)

// THE FACTORY — no `as any`: asClass(schema) is concrete (no deferred conditional).
const asClassPath = <Sch extends S.Top>(schema: Sch) =>
  class extends S.asClass(schema) {
    static is = S.is(this)
    static fromString = (input: string): Sch['Type'] => S.decodeSync(this)(input)
  }

const RelDir = asClassPath(relDirCodec)
type RelDir = typeof RelDir.Type

// PROOFS — statics correctly typed/bound, and it's still a usable schema:
const _fromStr: Equal<ReturnType<typeof RelDir.fromString>, RelDirVal> = true
const guard: (u: unknown) => boolean = RelDir.is
const parsed = RelDir.fromString('a/b/c')
const viaSchema = S.decodeSync(RelDir)('x/y')
console.log(
  'proofs:',
  _fromStr,
  '| fromString:',
  parsed.segments,
  '| guard:',
  RelDir.is(parsed),
  '| schema:',
  viaSchema.segments,
)
