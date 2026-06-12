import type { Equivalence, Result } from 'effect'
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
 *
 * The decode/encode family takes `unknown` input (the dominant call shape:
 * boundary data). `decode`/`encode` are effectful, `*Sync` throw on failure,
 * and `*Result` return `Result` for pure pipelines.
 */
export interface DomainStatics<$Schema extends S.Top> {
  /** The class itself, as a schema value — for expression positions. */
  readonly $: $Schema & DomainStatics<$Schema>
  readonly is: (input: unknown) => input is $Schema['Type']
  readonly decode: ReturnType<typeof S.decodeUnknownEffect<$Schema>>
  readonly decodeSync: (input: unknown, options?: SchemaAST.ParseOptions) => $Schema['Type']
  readonly decodeResult: (
    input: unknown,
    options?: SchemaAST.ParseOptions,
  ) => Result.Result<$Schema['Type'], S.SchemaError>
  readonly encode: ReturnType<typeof S.encodeUnknownEffect<$Schema>>
  readonly encodeSync: (input: unknown, options?: SchemaAST.ParseOptions) => $Schema['Encoded']
  readonly encodeResult: (
    input: unknown,
    options?: SchemaAST.ParseOptions,
  ) => Result.Result<$Schema['Encoded'], S.SchemaError>
  readonly equals: Equivalence.Equivalence<$Schema['Type']>
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
    static get $() {
      return this
    }
    static get is() {
      return derived(this, 'is', S.is)
    }
    static get decode() {
      return derived(this, 'decode', S.decodeUnknownEffect)
    }
    static get decodeSync() {
      return derived(this, 'decodeSync', S.decodeUnknownSync)
    }
    static get decodeResult() {
      return derived(this, 'decodeResult', S.decodeUnknownResult)
    }
    static get encode() {
      return derived(this, 'encode', S.encodeUnknownEffect)
    }
    static get encodeSync() {
      return derived(this, 'encodeSync', S.encodeUnknownSync)
    }
    static get encodeResult() {
      return derived(this, 'encodeResult', S.encodeUnknownResult)
    }
    static get equals() {
      return derived(this, 'equals', S.toEquivalence)
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
 * Also exposes the tag literal as a static `_tag`, so lookup tables and
 * Match arms can reference `Violation._tag` without an instance.
 *
 * ```ts
 * export class Violation extends Sch.TaggedClass<Violation>()('Violation', {
 *   detail: S.String,
 * }) {}
 *
 * Violation._tag // 'Violation'
 * ```
 */
export const TaggedClass =
  <Self = never, Brand = {}>(identifier?: string) =>
  <Tag extends string, const Fields extends S.Struct.Fields>(
    tag: Tag,
    fields: Fields,
    annotations?: S.Annotations.Declaration<Self, readonly [S.TaggedStruct<Tag, Fields>]>,
  ): S.Class<Self, S.TaggedStruct<Tag, Fields>, Brand> &
    DomainStatics<S.Class<Self, S.TaggedStruct<Tag, Fields>, Brand>> & { readonly _tag: Tag } =>
    Object.assign(
      withDomainStatics(
        S.TaggedClass<Self, Brand>(identifier)(tag, fields, annotations) as AnyClass,
      ),
      { _tag: tag },
    )
