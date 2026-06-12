import type { Equivalence } from 'effect'
import { Schema as S } from 'effect'
import type * as SchemaAST from 'effect/SchemaAST'

/**
 * Companion operations derived from a schema class and exposed as statics,
 * so the class name doubles as the concept's namespace at call sites
 * (`Order.is(x)`, `Order.decodeSync(json)`).
 *
 * Derivations are lazy and `this`-bound: they are computed from the final
 * (most-derived) class on first access and memoized per class. Laziness is
 * required for correctness, not just speed — deriving eagerly from the
 * intermediate base would make `decode` construct base-class instances,
 * silently dropping any methods or getters declared on the final class.
 */
export interface DomainStatics<$Schema extends S.Top> {
  readonly is: (input: unknown) => input is $Schema['Type']
  readonly decode: ReturnType<typeof S.decodeUnknownEffect<$Schema>>
  readonly decodeSync: (input: unknown, options?: SchemaAST.ParseOptions) => $Schema['Type']
  readonly encode: ReturnType<typeof S.encodeUnknownEffect<$Schema>>
  readonly encodeSync: (input: unknown, options?: SchemaAST.ParseOptions) => $Schema['Encoded']
  readonly equivalence: Equivalence.Equivalence<$Schema['Type']>
}

type AnyClass = new (...args: ReadonlyArray<any>) => any

const derivations = new WeakMap<object, Map<string, unknown>>()

const derived = <$T>(cls: object, key: string, make: (schema: any) => $T): $T => {
  let slot = derivations.get(cls)
  if (slot === undefined) {
    slot = new Map()
    derivations.set(cls, slot)
  }
  if (!slot.has(key)) slot.set(key, make(cls))
  return slot.get(key) as $T
}

// dprint-ignore
const withDomainStatics = (Base: AnyClass): any =>
  class extends Base {
    static get is() {
      return derived(this, 'is', S.is)
    }
    static get decode() {
      return derived(this, 'decode', S.decodeUnknownEffect)
    }
    static get decodeSync() {
      return derived(this, 'decodeSync', S.decodeUnknownSync)
    }
    static get encode() {
      return derived(this, 'encode', S.encodeUnknownEffect)
    }
    static get encodeSync() {
      return derived(this, 'encodeSync', S.encodeUnknownSync)
    }
    static get equivalence() {
      return derived(this, 'equivalence', S.toEquivalence)
    }
  }

/**
 * {@link S.Class} plus derived {@link DomainStatics}.
 *
 * Replaces the hand-pasted per-class static block
 * (`static is = Schema.is(X)`, `static decode = ...`, ...) with one
 * derivation, so declaring a schema-backed domain class is a single line:
 *
 * ```ts
 * import { Sch } from '@kitz/sch'
 * import { Schema as S } from 'effect'
 *
 * export class Order extends Sch.Class<Order>()('Order', {
 *   id: S.String,
 *   amount: S.Number,
 * }) {}
 *
 * Order.is(value)
 * Order.decodeSync(json)
 * ```
 *
 * `Self` must be provided explicitly (same constraint as `S.Class`).
 */
export const Class =
  <Self = never, Brand = {}>() =>
  <const Fields extends S.Struct.Fields>(
    identifier: string,
    fields: Fields,
    annotations?: S.Annotations.Declaration<Self, readonly [S.Struct<Fields>]>,
  ): S.Class<Self, S.Struct<Fields>, Brand> &
    DomainStatics<S.Class<Self, S.Struct<Fields>, Brand>> =>
    withDomainStatics(S.Class<Self, Brand>(identifier)(fields, annotations) as AnyClass)

/**
 * {@link S.TaggedClass} plus derived {@link DomainStatics}.
 *
 * ```ts
 * export class Violation extends Sch.TaggedClass<Violation>()('Violation', {
 *   detail: S.String,
 * }) {}
 * ```
 */
export const TaggedClass =
  <Self = never, Brand = {}>() =>
  <Tag extends string, const Fields extends S.Struct.Fields>(
    tag: Tag,
    fields: Fields,
    annotations?: S.Annotations.Declaration<Self, readonly [S.TaggedStruct<Tag, Fields>]>,
  ): S.Class<Self, S.TaggedStruct<Tag, Fields>, Brand> &
    DomainStatics<S.Class<Self, S.TaggedStruct<Tag, Fields>, Brand>> =>
    withDomainStatics(S.TaggedClass<Self, Brand>()(tag, fields, annotations) as AnyClass)
