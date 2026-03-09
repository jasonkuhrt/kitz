import { bench } from '@ark/attest'
import type * as Simplify from './simplify.js'

// Warmup: Exercise Simplify's evaluation path for each container type
// Uses different types than benchmarks to avoid false cache hits
type _warm_object = Simplify.Top<{ __warmup: 0 }>
type _warm_array = Simplify.All<Array<0>>
type _warm_readonly = Simplify.All<ReadonlyArray<0>>
type _warm_map = Simplify.All<Map<0, 0>>
type _warm_set = Simplify.All<Set<0>>
type _warm_weakmap = Simplify.All<WeakMap<object, 0>>
type _warm_weakset = Simplify.All<WeakSet<object>>
type _warm_promise = Simplify.All<Promise<0>>

// Warmup HKT custom traverser
import type { Fn } from '#fn'
import type { Num } from '#num'

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

// Benchmarks: Now measuring OUR implementation cost only

// Depth variations
bench('Top > simple intersection', () => {
  return {} as Simplify.Top<{ a: 1 } & { b: 2 }>
}).types([81, 'instantiations'])

bench('To<2> > nested intersection', () => {
  return {} as Simplify.To<2, { a: 1 } & { b: { c: 2 } & { d: 3 } }>
}).types([101, 'instantiations'])

bench('Auto > moderate depth', () => {
  return {} as Simplify.Auto<{ a: { b: { c: { d: { e: 1 } & { f: 2 } } } } }>
}).types([1564, 'instantiations'])

// Array
bench('Array > object elements', () => {
  return {} as Simplify.All<Array<{ a: 1 } & { b: 2 }>>
}).types([36, 'instantiations'])

bench('Array > primitives', () => {
  return {} as Simplify.All<Array<number>>
}).types([16, 'instantiations'])

// Set
bench('Set > object element', () => {
  return {} as Simplify.All<Set<{ a: 1 } & { b: 2 }>>
}).types([131, 'instantiations'])

bench('Set > primitive', () => {
  return {} as Simplify.All<Set<boolean>>
}).types([74, 'instantiations'])

// Map
bench('Map > both objects', () => {
  return {} as Simplify.All<Map<{ k: 1 } & { v: 2 }, { a: 3 } & { b: 4 }>>
}).types([224, 'instantiations'])

bench('Map > primitives', () => {
  return {} as Simplify.All<Map<string, number>>
}).types([96, 'instantiations'])

bench('Map > key object only', () => {
  return {} as Simplify.All<Map<{ a: 1 } & { b: 2 }, string>>
}).types([161, 'instantiations'])

bench('Map > value object only', () => {
  return {} as Simplify.All<Map<string, { c: 3 } & { d: 4 }>>
}).types([161, 'instantiations'])

// WeakMap
bench('WeakMap > both objects', () => {
  return {} as Simplify.All<WeakMap<{ k: 1 } & { v: 2 }, { a: 3 } & { b: 4 }>>
}).types([266, 'instantiations'])

// WeakSet
bench('WeakSet > object', () => {
  return {} as Simplify.All<WeakSet<{ a: 1 } & { b: 2 }>>
}).types([162, 'instantiations'])

// Promise
bench('Promise > object', () => {
  return {} as Simplify.All<Promise<{ a: 1 } & { b: 2 }>>
}).types([136, 'instantiations'])

bench('Promise > primitive', () => {
  return {} as Simplify.All<Promise<string>>
}).types([71, 'instantiations'])

// Nullable
bench('nullable union', () => {
  return {} as Simplify.All<({ a: 1 } & { b: 2 }) | null>
}).types([88, 'instantiations'])

// HKT registry cost
bench('HKT registry > empty (baseline)', () => {
  return {} as Simplify.All<{ a: 1 } & { b: 2 }>
}).types([81, 'instantiations'])

bench('HKT registry > with custom traverser (Box)', () => {
  return {} as Simplify.All<Box<{ a: 1 } & { b: 2 }>>
}).types([283, 'instantiations'])
