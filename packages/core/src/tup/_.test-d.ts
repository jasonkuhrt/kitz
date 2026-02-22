import type { Type as A } from '#kitz/assert/assert'
import { Ts } from '#ts'
import { Tup } from './_.js'

type _Push = A.Cases<
  A.exact.of<Tup.Push<[1, 2], 3>, [1, 2, 3]>,
  A.exact.of<Tup.Push<[], 'first'>, ['first']>,
  A.exact.of<Tup.Push<[string], number>, [string, number]>
>

type _IsMultiple = A.Cases<
  A.exact.of<Tup.IsMultiple<[1, 2]>, true>,
  A.exact.of<Tup.IsMultiple<[1, 2, 3]>, true>,
  A.exact.of<Tup.IsMultiple<[1]>, false>,
  A.exact.of<Tup.IsMultiple<[]>, false>,
  A.exact.of<Tup.IsMultiple<string>, false>
>

type _Flatten = A.Cases<
  A.exact.of<Tup.Flatten<[[1, 2], [3, 4]]>, readonly [1, 2, 3, 4]>,
  A.exact.of<Tup.Flatten<[['a'], ['b', 'c']]>, readonly ['a', 'b', 'c']>,
  A.exact.of<Tup.Flatten<[]>, []>
>

type _IsEmpty = A.Cases<
  A.exact.of<Tup.IsEmpty<[]>, true>,
  A.exact.of<Tup.IsEmpty<readonly []>, true>,
  A.exact.of<Tup.IsEmpty<[1]>, false>,
  A.exact.of<Tup.IsEmpty<[1, 2, 3]>, false>
>

type Users = readonly [
  { id: 'alice'; name: 'Alice' },
  { id: 'bob'; name: 'Bob' },
]

type _IndexBy = A.Cases<
  A.exact.of<Tup.IndexBy<Users, 'id'>['alice'], { id: 'alice'; name: 'Alice' }>,
  A.exact.of<Tup.IndexBy<Users, 'id'>['bob'], { id: 'bob'; name: 'Bob' }>
>

type _GetLastValue = A.Cases<
  A.exact.of<Tup.GetLastValue<[1, 2, 3]>, 3>,
  A.exact.of<Tup.GetLastValue<['a']>, 'a'>,
  A.exact.of<Tup.GetLastValue<['x', 'y', 'z']>, 'z'>
>

type _DropUntilIndex = A.Cases<
  A.exact.of<Tup.DropUntilIndex<[1, 2, 3], 0>, [1, 2, 3]>,
  A.exact.of<Tup.DropUntilIndex<[1, 2, 3], 2>, [3]>,
  A.exact.of<Tup.DropUntilIndex<[1, 2, 3], 3>, []>
>

type _GetAtNextIndex = A.Cases<
  A.exact.of<Tup.GetAtNextIndex<[1, 2, 3], 0>, 2>,
  A.exact.of<Tup.GetAtNextIndex<[1, 2, 3], 2>, undefined>
>

type _FindIndexForValue = A.Cases<
  A.exact.of<Tup.FindIndexForValue<'b', ['a', 'b', 'c']>, 1>,
  A.exact.of<Tup.FindIndexForValue<'a', ['a', 'b', 'c']>, 0>,
  A.exact.of<Tup.FindIndexForValue<'c', ['a', 'b', 'c']>, 2>
>

type _TakeValuesBefore = A.Cases<
  A.exact.of<Tup.TakeValuesBefore<'c', ['a', 'b', 'c', 'd']>, ['a', 'b']>,
  A.exact.of<Tup.TakeValuesBefore<'a', ['a', 'b', 'c']>, []>,
  A.exact.of<Tup.TakeValuesBefore<'d', ['a', 'b', 'c', 'd']>, ['a', 'b', 'c']>
>

type _ToIndexByObjectKey = A.Cases<
  A.equiv.of<
    Tup.ToIndexByObjectKey<[{ name: 'a' }, { name: 'b' }], 'name'>,
    { a: { name: 'a' }; b: { name: 'b' } }
  >,
  A.exact.of<Tup.ToIndexByObjectKey<[], 'name'>, {}>
>

type _PreviousItem = A.Cases<
  A.exact.of<Tup.PreviousItem<[], 1>, undefined>,
  A.exact.of<Tup.PreviousItem<[1, 2, 3], 2>, 1>,
  A.exact.of<Tup.PreviousItem<[1, 2, 3], 1>, undefined>,
  A.exact.of<Tup.PreviousItem<[{ x: 1 }, { y: 2 }], { x: 1 }>, undefined>,
  A.exact.of<Tup.PreviousItem<[{ x: 1 }, { y: 2 }], { y: 2 }>, { x: 1 }>,
  A.exact.of<Tup.PreviousItem<[{ x: 1 }, { y: 2; w: 3 }], { y: 2 }>, { x: 1 }>
>

// GetNextIndexOr and FindValueAfterOr test OrDefault indirectly
type _GetNextIndexOr = A.Cases<
  A.exact.of<Tup.GetNextIndexOr<['a', 'b', 'c'], 0, 'default'>, 'b'>,
  A.exact.of<Tup.GetNextIndexOr<['a', 'b', 'c'], 2, 'default'>, 'default'>
>
