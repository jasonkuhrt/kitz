// dprint-ignore-file
import type { Num } from '#num'
import { Ts } from '#ts'
import type { Fn } from '#fn'
import type * as Simplify from './simplify.js'
import { Assert } from '#kitz/assert'

const A = Assert.Type.exact

// Fixtures

type i1 = { a: 1 } & { b: 2 }
type i2 = { m: 1 } & { n: 2 }
type i1s = { a: 1; b: 2 }
type i2s = { m: 1; n: 2 }

// Depth control
// @ts-expect-error - invalid depth
A.ofAs<{}>()                                              .onAs<Simplify.To<99, {}>>()
A.ofAs<i1>()                                              .onAs<Simplify.To<0, i1>>()
A.ofAs<i1s>()                                             .onAs<Simplify.To<1, i1>>()
A.ofAs<{ a: 1; b: { c: 2; d: 3 } }>()                     .onAs<Simplify.To<2, { a: 1 } & { b: { c: 2 } & { d: 3 } }>>()
A.ofAs<{ a: 1; b: { c: 2 } & { d: 3 } }>()                .onAs<Simplify.Top<{ a: 1 } & { b: { c: 2 } & { d: 3 } }>>()
A.ofAs<{ a: 1; b: { c: 2; d: 3 } }>()                     .onAs<Simplify.All<{ a: 1 } & { b: { c: 2 } & { d: 3 } }>>()
// Nullable distribution
A.ofAs<i1s | null>()                                      .onAs<Simplify.Top<i1 | null>>()
A.ofAs<i1s | undefined>()                                 .onAs<Simplify.Top<i1 | undefined>>()
A.ofAs<{ a: 1; b: { c: 2; d: 3 } | null }>()              .onAs<Simplify.All<{ a: 1 } & { b: ({ c: 2 } & { d: 3 }) | null }>>()
// Container traversal
A.ofAs<Array<i1s>>()                                      .onAs<Simplify.All<Array<i1>>>()
A.ofAs<ReadonlyArray<i1s>>()                              .onAs<Simplify.All<ReadonlyArray<i1>>>()
A.ofAs<Set<i1s>>()                                        .onAs<Simplify.All<Set<i1>>>()
A.ofAs<Map<{ k: 1; v: 2 }, { a: 3; b: 4 }>>()             .onAs<Simplify.All<Map<{ k: 1 } & { v: 2 }, { a: 3 } & { b: 4 }>>>()
A.ofAs<WeakSet<i1s>>()                                    .onAs<Simplify.All<WeakSet<i1>>>()
A.ofAs<WeakMap<{ k: 1; v: 2 }, { a: 3; b: 4 }>>()         .onAs<Simplify.All<WeakMap<{ k: 1 } & { v: 2 }, { a: 3 } & { b: 4 }>>>()
A.ofAs<Promise<i1s>>()                                    .onAs<Simplify.All<Promise<i1>>>()
A.ofAs<Map<string, Array<i1s>>>()                         .onAs<Simplify.All<Map<string, Array<i1>>>>()
// Primitive optimization
A.ofAs<Array<number>>()                                   .onAs<Simplify.All<Array<number>>>()
A.ofAs<Set<boolean>>()                                    .onAs<Simplify.All<Set<boolean>>>()
A.ofAs<Map<string, number>>()                             .onAs<Simplify.All<Map<string, number>>>()
A.ofAs<Promise<string>>()                                 .onAs<Simplify.All<Promise<string>>>()
// Preserved built-ins
A.ofAs<{ created: Date; nested: { pattern: RegExp } }>() .onAs<Simplify.All<{ created: Date; nested: { pattern: RegExp } }>>()
A.ofAs<{ err: Error; fn: Function }>()                   .onAs<Simplify.All<{ err: Error; fn: Function }>>()

// Custom preserved type
export interface CustomBrand {
  readonly __brand: 'custom'
  value: string
}

declare global {
  namespace KITZ {
    namespace Ts {
      interface PreserveTypes {
        _custom: CustomBrand
      }
    }
  }
}

A.ofAs<CustomBrand>()                                     .onAs<Simplify.All<CustomBrand>>()
A.ofAs<{ custom: CustomBrand; other: i1s }>()             .onAs<Simplify.All<{ custom: CustomBrand; other: i1 }>>()

// HKT custom traverser
export interface Box<T> {
  readonly value: T
}

export interface BoxTraverser extends Fn.Kind.Kind {
  return: this['parameters'] extends [infer $T, infer $DN extends Num.Literal, infer $SN]
    ? $T extends Box<infer V> ? Box<Simplify.To<$DN, V, $SN>>
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

A.ofAs<Box<i1s>>()                                        .onAs<Simplify.All<Box<i1>>>()
A.ofAs<{ data: Box<i1s> }>()                              .onAs<Simplify.All<{ data: Box<i1> }>>()

// Arrays / Tuples

A.ofAs<[i1s | i2s]>()                                     .onAs<Ts.Simplify.Top<[i1 | i2]>>()
A.ofAs<readonly [i1s | i2s]>()                            .onAs<Ts.Simplify.Top<readonly [i1 | i2]>>()

A.ofAs<i1s[]>()                                           .onAs<Ts.Simplify.Top<i1[]>>()

A.ofAs<['a' | 'b']>()                                     .onAs<Ts.Simplify.Top<['a' | 'b']>>()
A.ofAs<readonly ['a' | 'b']>()                            .onAs<Ts.Simplify.Top<readonly ['a' | 'b']>>()

// unions
A.ofAs<'a' | 'b'>()                                       .onAs<Ts.Simplify.Top<'a' | 'b'>>()

// Edge cases

A.ofAs<{}>()                                              .onAs<Simplify.All<{} & {}>>()
A.ofAs<SelfRef>()                                         .onAs<Simplify.All<SelfRef>>()

type SelfRef = { self: SelfRef; data: string }
