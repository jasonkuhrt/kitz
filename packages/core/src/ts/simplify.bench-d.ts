import type { Fn } from '#fn'
import type { Num } from '#num'
import type * as Simplify from './simplify.js'

// Warmup: Exercise Simplify's evaluation path for each container type.
// Uses different types than benchmarks to avoid false cache hits.
type _warm_object = Simplify.Top<{ __warmup: 0 }>
type _warm_array = Simplify.All<Array<0>>
type _warm_readonly = Simplify.All<ReadonlyArray<0>>
type _warm_map = Simplify.All<Map<0, 0>>
type _warm_set = Simplify.All<Set<0>>
type _warm_weakmap = Simplify.All<WeakMap<object, 0>>
type _warm_weakset = Simplify.All<WeakSet<object>>
type _warm_promise = Simplify.All<Promise<0>>

// Warmup HKT custom traverser
interface Box<T> {
  readonly value: T
}

interface BoxTraverser extends Fn.Kind.Kind {
  return: this['parameters'] extends [infer $T, infer $DN extends Num.Literal, infer $SN]
    ? $T extends Box<infer V>
      ? Box<Simplify.To<$DN, V, $SN>>
      : never
    : never
}

declare global {
  namespace KITZ {
    namespace Simplify {
      interface Traversables {
        _box: { extends: Box<any>; traverse: BoxTraverser }
      }
    }
  }
}

type _warm_box = Simplify.All<Box<0>>

// Type-instantiation regression cases (previously gated via @ark/attest bench).
// Kept as type aliases so tsc still exercises them; instantiation-count gating
// will be reintroduced via a bun-native tool in a follow-up.

// Depth variations
type _Top_simple_intersection = Simplify.Top<{ a: 1 } & { b: 2 }>
type _To_2_nested = Simplify.To<2, { a: 1 } & { b: { c: 2 } & { d: 3 } }>
type _Auto_moderate = Simplify.Auto<{ a: { b: { c: { d: { e: 1 } & { f: 2 } } } } }>

// Array
type _Array_objects = Simplify.All<Array<{ a: 1 } & { b: 2 }>>
type _Array_primitives = Simplify.All<Array<number>>

// Set
type _Set_object = Simplify.All<Set<{ a: 1 } & { b: 2 }>>
type _Set_primitive = Simplify.All<Set<boolean>>

// Map
type _Map_both_objects = Simplify.All<Map<{ k: 1 } & { v: 2 }, { a: 3 } & { b: 4 }>>
type _Map_primitives = Simplify.All<Map<string, number>>
type _Map_key_object = Simplify.All<Map<{ a: 1 } & { b: 2 }, string>>
type _Map_value_object = Simplify.All<Map<string, { c: 3 } & { d: 4 }>>

// WeakMap
type _WeakMap_both_objects = Simplify.All<WeakMap<{ k: 1 } & { v: 2 }, { a: 3 } & { b: 4 }>>

// WeakSet
type _WeakSet_object = Simplify.All<WeakSet<{ a: 1 } & { b: 2 }>>

// Promise
type _Promise_object = Simplify.All<Promise<{ a: 1 } & { b: 2 }>>
type _Promise_primitive = Simplify.All<Promise<string>>

// Nullable
type _Nullable_union = Simplify.All<({ a: 1 } & { b: 2 }) | null>

// HKT registry cost
type _HKT_baseline = Simplify.All<{ a: 1 } & { b: 2 }>
type _HKT_with_box = Simplify.All<Box<{ a: 1 } & { b: 2 }>>
