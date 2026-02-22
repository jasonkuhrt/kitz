import type { Type as A } from '#kitz/assert/assert'
import { Ts } from '#ts'

// dprint-ignore
type _IsAnyMemberExtends = A.Cases<
A.exact.of<Ts.Union.IsAnyMemberExtends<string | number, string>,           true>,
A.exact.of<Ts.Union.IsAnyMemberExtends<number | boolean, string>,          false>,
A.exact.of<Ts.Union.IsAnyMemberExtends<'a' | 'b' | 1, string>,             true>,
A.exact.of<Ts.Union.IsAnyMemberExtends<string | Promise<number>, Promise<any>>, true>,
A.exact.of<Ts.Union.IsAnyMemberExtends<never, string>,                     false>
>

// Test __FORCE_DISTRIBUTION__ marker
type WrapInArray<$T> = $T extends Ts.Union.__FORCE_DISTRIBUTION__ ? [$T] : never

type _ForceDistribution = A.Cases<
  A.exact.of<WrapInArray<'a' | 'b' | 'c'>, ['a'] | ['b'] | ['c']>,
  A.exact.of<WrapInArray<1 | 2 | 3>, [1] | [2] | [3]>,
  A.exact.of<WrapInArray<string>, [string]>
>
