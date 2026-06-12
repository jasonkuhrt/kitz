/* oxlint-disable typescript/no-unnecessary-type-arguments -- explicit type arguments keep type-level regression cases readable. */
import type { Type as A } from '@kitz/assert/assert'
import { Ts } from '#ts'
import { Tup } from './_.js'

type _Push = A.Cases<A.exact.of<Tup.Push<[1, 2], 3>, [1, 2, 3]>>

type _IsMultiple = A.Cases<
  A.exact.of<Tup.IsMultiple<[1, 2]>, true>,
  A.exact.of<Tup.IsMultiple<[1, 2, 3]>, true>,
  A.exact.of<Tup.IsMultiple<[1]>, false>
>

type _Flatten = A.Cases<A.exact.of<Tup.Flatten<[[1, 2], [3, 4]]>, readonly [1, 2, 3, 4]>>

type _IsEmpty = A.Cases<
  A.exact.of<Tup.IsEmpty<[]>, true>,
  A.exact.of<Tup.IsEmpty<readonly []>, true>
>

type Users = readonly [{ id: 'alice'; name: 'Alice' }, { id: 'bob'; name: 'Bob' }]

type _IndexBy = A.Cases

type _GetLastValue = A.Cases<A.exact.of<Tup.GetLastValue<[1, 2, 3]>, 3>>

type _DropUntilIndex = A.Cases<A.exact.of<Tup.DropUntilIndex<[1, 2, 3], 0>, [1, 2, 3]>>

type _GetAtNextIndex = A.Cases

type _FindIndexForValue = A.Cases<A.exact.of<Tup.FindIndexForValue<'b', ['a', 'b', 'c']>, 1>>

type _TakeValuesBefore = A.Cases<
  A.exact.of<Tup.TakeValuesBefore<'c', ['a', 'b', 'c', 'd']>, ['a', 'b']>
>

type _ToIndexByObjectKey = A.Cases

type _PreviousItem = A.Cases<
  A.exact.of<Tup.PreviousItem<[], 1>, undefined>,
  A.exact.of<Tup.PreviousItem<[1, 2, 3], 2>, 1>,
  A.exact.of<Tup.PreviousItem<[1, 2, 3], 1>, undefined>,
  A.exact.of<Tup.PreviousItem<[{ x: 1 }, { y: 2 }], { x: 1 }>, undefined>
>

// GetNextIndexOr and FindValueAfterOr test OrDefault indirectly
type _GetNextIndexOr = A.Cases
