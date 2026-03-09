import type { Num } from '#num'

export type Ensure<$H> = $H extends readonly any[] ? $H : [$H]

/**
 * Push a value onto the end of a tuple type.
 *
 * @template $T - The tuple type to push to
 * @template $V - The value type to push
 *
 * @example
 * ```ts
 * type T1 = Tup.Push<[1, 2], 3>        // [1, 2, 3]
 * type T2 = Tup.Push<[], 'first'>      // ['first']
 * type T3 = Tup.Push<[string], number> // [string, number]
 * ```
 */
export type Push<$T extends any[], $V> = [...$T, $V]

/**
 * Check if a tuple has at least 2 elements.
 *
 * Returns `true` if the tuple has 2 or more elements, `false` otherwise.
 *
 * @template $T - The type to check
 *
 * @example
 * ```ts
 * type T1 = Tup.IsMultiple<[1, 2]>         // true
 * type T2 = Tup.IsMultiple<[1, 2, 3]>      // true
 * type T3 = Tup.IsMultiple<[1]>            // false
 * type T4 = Tup.IsMultiple<[]>             // false
 * type T5 = Tup.IsMultiple<string>         // false (not a tuple)
 * ```
 */
export type IsMultiple<$T> = $T extends [unknown, unknown, ...unknown[]] ? true : false

/**
 * Flatten nested readonly tuples into a single-level tuple.
 *
 * @template $T - The nested tuple type to flatten
 *
 * @example
 * ```ts
 * type T1 = Tup.Flatten<[[1, 2], [3, 4]]>           // [1, 2, 3, 4]
 * type T2 = Tup.Flatten<[['a'], ['b', 'c'], ['d']]> // ['a', 'b', 'c', 'd']
 * type T3 = Tup.Flatten<[]>                         // []
 * ```
 */
// oxfmt-ignore
export type Flatten<$T extends readonly (readonly any[])[]> =
  $T extends readonly [infer __head__ extends readonly any[], ...infer __tail__ extends readonly (readonly any[])[]]
    ? readonly [...__head__, ...Flatten<__tail__>]
    : []

/**
 * Index a tuple of objects by a nested key 2 levels deep.
 *
 * @template $Arr - The tuple of objects to index
 * @template $Key1 - The first-level key
 * @template $Key2 - The second-level key within the first key's value
 *
 * @example
 * ```ts
 * type Items = [
 *   { meta: { id: 'a', data: 1 } },
 *   { meta: { id: 'b', data: 2 } }
 * ]
 * type Indexed = Tup.IndexByDepth2<Items, 'meta', 'id'>
 * // { a: { id: 'a', data: 1 }, b: { id: 'b', data: 2 } }
 * ```
 */
// oxfmt-ignore
export type IndexByDepth2<
  $Arr extends any[],
  $Key1 extends keyof $Arr[number],
  $Key2 extends keyof $Arr[number][$Key1],
> = $Arr extends [infer __first__ extends $Arr[number], ...infer __rest__ extends $Arr[number][]]
    ? { [_ in __first__[$Key1][$Key2]]: __first__[$Key1] } & IndexByDepth2<__rest__, $Key1, $Key2>
    : {}

/**
 * Index a tuple of objects by a key, creating a record from key values to objects.
 *
 * @template $Arr - The readonly tuple of objects to index
 * @template $Key - The key to use for indexing
 *
 * @example
 * ```ts
 * type Users = readonly [
 *   { id: 'alice', name: 'Alice' },
 *   { id: 'bob', name: 'Bob' }
 * ]
 * type ById = Tup.IndexBy<Users, 'id'>
 * // { alice: { id: 'alice', name: 'Alice' }, bob: { id: 'bob', name: 'Bob' } }
 * ```
 */
// oxfmt-ignore
export type IndexBy<
  $Arr extends readonly any[],
  $Key extends keyof $Arr[number],
> = $Arr extends readonly [infer __first__ extends $Arr[number], ...infer __rest__ extends $Arr[number][]]
    ? { readonly [_ in __first__[$Key]]: __first__ } & IndexBy<__rest__, $Key>
    : {}

/**
 * Index a tuple by one key and map to a nested value 2 levels deep.
 *
 * @template $Arr - The readonly tuple of objects
 * @template $Key - The key to use for indexing
 * @template $ValueKey1 - The first-level key for the value
 * @template $ValueKey2 - The second-level key within the first value key
 *
 * @example
 * ```ts
 * type Items = readonly [
 *   { id: 'a', meta: { score: 100 } },
 *   { id: 'b', meta: { score: 200 } }
 * ]
 * type Scores = Tup.IndexByToValueDepth2<Items, 'id', 'meta', 'score'>
 * // { a: 100, b: 200 }
 * ```
 */
// oxfmt-ignore
export type IndexByToValueDepth2<
  $Arr extends readonly any[],
  $Key extends keyof $Arr[number],
  $ValueKey1 extends keyof $Arr[number],
  $ValueKey2 extends keyof $Arr[number][$ValueKey1],
> = $Arr extends readonly [infer __first__ extends $Arr[number], ...infer __rest__ extends readonly $Arr[number][]]
    ? { readonly [_ in __first__[$Key]]: __first__[$ValueKey1][$ValueKey2] } & IndexByToValueDepth2<__rest__, $Key, $ValueKey1, $ValueKey2>
    : {}

/**
 * Valid index keys for tuple access (number or stringified number).
 */
export type IndexKey = number | `${number}`

/**
 * Empty readonly tuple type.
 */
export type Empty = readonly []

/**
 * Check if a type is an empty tuple.
 *
 * @template $T - The type to check
 *
 * @example
 * ```ts
 * type T1 = Tup.IsEmpty<[]>           // true
 * type T2 = Tup.IsEmpty<[1]>          // false
 * type T3 = Tup.IsEmpty<[1, 2, 3]>    // false
 * ```
 */
export type IsEmpty<$T> = $T extends Empty ? true : false

/**
 * Get the previous item in a tuple relative to a given item.
 * Returns `undefined` if the item is first or not found.
 *
 * @template $Items - The tuple to search in
 * @template $OfItem - The item to find the previous item for
 *
 * @example
 * ```ts
 * type T1 = Tup.PreviousItem<['a', 'b', 'c'], 'b'>  // 'a'
 * type T2 = Tup.PreviousItem<['a', 'b', 'c'], 'c'>  // 'b'
 * type T3 = Tup.PreviousItem<['a', 'b', 'c'], 'a'>  // undefined (first item)
 * type T4 = Tup.PreviousItem<['a', 'b', 'c'], 'd'>  // undefined (not found)
 * ```
 */
// oxfmt-ignore
export type PreviousItem<$Items extends readonly any[], $OfItem> =
  $Items extends [infer $Next, ...infer $Rest]
    ? $Next extends $OfItem
      ? undefined // No previous of first
      : PreviousItem_<$OfItem, $Next, $Rest>
    : undefined // empty tuple

// oxfmt-ignore
type PreviousItem_<$OfItem, $PreviousItem extends $Items[number], $Items extends readonly any[]> =
  $Items extends [infer $NextItem, ...infer $Rest]
    ? $NextItem extends $OfItem
      ? $PreviousItem
      : PreviousItem_<$OfItem, $NextItem, $Rest>
    : never

/**
 * Non-empty readonly tuple type.
 */
export type NonEmpty = readonly [any, ...(readonly any[])]

/**
 * Intersect all items in a tuple into a single type.
 *
 * @template $Items - The tuple of items to intersect
 *
 * @example
 * ```ts
 * type T1 = Tup.IntersectItems<[{ a: 1 }, { b: 2 }]>  // { a: 1 } & { b: 2 }
 * type T2 = Tup.IntersectItems<[{ a: 1 }]>            // { a: 1 }
 * type T3 = Tup.IntersectItems<[]>                    // {}
 * ```
 */
// oxfmt-ignore
export type IntersectItems<$Items extends readonly any[]> =
  $Items extends [infer $First, ...infer $Rest extends any[]]
    ? $First & IntersectItems<$Rest>
    : {}

/**
 * Convert a tuple of objects to an indexed record by object key.
 *
 * @template $Items - The readonly tuple of objects
 * @template $Key - The key to use for indexing
 *
 * @example
 * ```ts
 * type Items = readonly [
 *   { id: 'user1', name: 'Alice' },
 *   { id: 'user2', name: 'Bob' }
 * ]
 * type ById = Tup.ToIndexByObjectKey<Items, 'id'>
 * // { user1: { id: 'user1', name: 'Alice' }, user2: { id: 'user2', name: 'Bob' } }
 * ```
 */
// oxfmt-ignore
export type ToIndexByObjectKey<$Items extends readonly object[], $Key extends keyof $Items[number]> =
  IntersectItems<{
    [$Index in keyof $Items]:
      $Key extends keyof $Items[$Index]
      ? {
          [_ in $Items[$Index][$Key] & string]: $Items[$Index]
        }
      : never
  }>

/**
 * Get the item at the next index in a tuple.
 *
 * @template $Items - The readonly tuple
 * @template $Index - The current index (as number literal)
 *
 * @example
 * ```ts
 * type Items = ['a', 'b', 'c']
 * type T1 = Tup.GetAtNextIndex<Items, 0>  // 'b'
 * type T2 = Tup.GetAtNextIndex<Items, 1>  // 'c'
 * type T3 = Tup.GetAtNextIndex<Items, 2>  // undefined (no next)
 * ```
 */
// oxfmt-ignore
export type GetAtNextIndex<$Items extends readonly any[], $Index extends Num.Literal> =
  $Items[Num.PlusOne<$Index>]

/**
 * Get the item at the next index, or a default value if it doesn't exist.
 *
 * @template $Items - The readonly tuple
 * @template $Index - The current index
 * @template $Or - The default value if next index doesn't exist
 *
 * @example
 * ```ts
 * type Items = ['a', 'b', 'c']
 * type T1 = Tup.GetNextIndexOr<Items, 0, 'default'>  // 'b'
 * type T2 = Tup.GetNextIndexOr<Items, 2, 'default'>  // 'default'
 * ```
 */
// oxfmt-ignore
export type GetNextIndexOr<$Items extends readonly any[], $Index extends Num.Literal, $Or> =
  OrDefault<GetAtNextIndex<$Items, $Index>, $Or>

/**
 * Drop N elements from the start of a tuple.
 *
 * @template $Tuple - The readonly tuple
 * @template $N - Number of elements to drop (0-4 supported)
 *
 * @example
 * ```ts
 * type Items = ['a', 'b', 'c', 'd', 'e']
 * type T1 = Tup.Tail<Items, 0>  // ['a', 'b', 'c', 'd', 'e']
 * type T2 = Tup.Tail<Items, 1>  // ['b', 'c', 'd', 'e']
 * type T3 = Tup.Tail<Items, 2>  // ['c', 'd', 'e']
 * type T4 = Tup.Tail<Items, 3>  // ['d', 'e']
 * ```
 */
// oxfmt-ignore
export type Tail<$Tuple extends readonly unknown[], $N extends number> =
  $Tuple extends readonly []                                        ? [] :
  $N extends 0                                                      ? $Tuple :
  $N extends 1                                                      ? $Tuple extends readonly [any, ...infer __rest__] ? __rest__ : [] :
  $N extends 2                                                      ? $Tuple extends readonly [any, any, ...infer __rest__] ? __rest__ : [] :
  $N extends 3                                                      ? $Tuple extends readonly [any, any, any, ...infer __rest__] ? __rest__ : [] :
  $N extends 4                                                      ? $Tuple extends readonly [any, any, any, any, ...infer __rest__] ? __rest__ : [] :
                                                                      never // Only 0-4 supported

/**
 * Drop items from the start of a tuple until reaching the specified index.
 *
 * @template $Items - The readonly tuple
 * @template $Index - The index to drop until (as number literal)
 *
 * @example
 * ```ts
 * type Items = ['a', 'b', 'c', 'd']
 * type T1 = Tup.DropUntilIndex<Items, 0>  // ['a', 'b', 'c', 'd']
 * type T2 = Tup.DropUntilIndex<Items, 1>  // ['b', 'c', 'd']
 * type T3 = Tup.DropUntilIndex<Items, 2>  // ['c', 'd']
 * ```
 */
// oxfmt-ignore
export type DropUntilIndex<$Items extends readonly any[], $Index extends Num.Literal> =
  $Index extends 0                                  ? $Items :
  $Items extends readonly [infer _, ...infer $Rest] ? DropUntilIndex<$Rest, Num.MinusOne<$Index>> :
                                                      []

/**
 * Add one to an index type.
 *
 * @template $Index - The index to increment
 */
export type IndexPlusOne<$Index extends Num.Literal> = Num.PlusOne<$Index>

/**
 * Get the last value in a non-empty tuple.
 *
 * @template $T - The non-empty tuple
 *
 * @example
 * ```ts
 * type T1 = Tup.GetLastValue<[1, 2, 3]>  // 3
 * type T2 = Tup.GetLastValue<['a']>      // 'a'
 * ```
 */
// oxfmt-ignore
export type GetLastValue<$T extends readonly [any, ...any[]]> =
  $T['length'] extends Num.Literal
    ? $T[Num.MinusOne<$T['length']>]
    : never

/**
 * Check if a value is the last value in a non-empty tuple.
 *
 * @template $Value - The value to check
 * @template $List - The non-empty tuple
 *
 * @example
 * ```ts
 * type T1 = Tup.IsLastValue<3, [1, 2, 3]>  // true
 * type T2 = Tup.IsLastValue<2, [1, 2, 3]>  // false
 * ```
 */
export type IsLastValue<$Value, $List extends readonly [any, ...any[]]> =
  $Value extends GetLastValue<$List> ? true : false

/**
 * Find the index of a value in a non-empty tuple.
 *
 * @template $Value - The value to find
 * @template $List - The non-empty readonly tuple
 *
 * @example
 * ```ts
 * type T1 = Tup.FindIndexForValue<'b', ['a', 'b', 'c']>  // 1
 * type T2 = Tup.FindIndexForValue<'a', ['a', 'b', 'c']>  // 0
 * ```
 */
// oxfmt-ignore
export type FindIndexForValue<$Value, $List extends NonEmpty> =
  FindIndexForValue_<$Value, $List, 0>

// oxfmt-ignore
type FindIndexForValue_<$Value, $List extends NonEmpty, $i extends Num.Literal> =
  $Value extends $List[$i]
    ? $i
    : FindIndexForValue_<$Value, $List, Num.PlusOne<$i>>

/**
 * Find the value that comes after a given value in a non-empty tuple.
 *
 * @template $Value - The value to find the successor of
 * @template $List - The non-empty readonly tuple
 *
 * @example
 * ```ts
 * type T1 = Tup.FindValueAfter<'a', ['a', 'b', 'c']>  // 'b'
 * type T2 = Tup.FindValueAfter<'b', ['a', 'b', 'c']>  // 'c'
 * type T3 = Tup.FindValueAfter<'c', ['a', 'b', 'c']>  // undefined (last item)
 * ```
 */
export type FindValueAfter<$Value, $List extends NonEmpty> = $List[Num.PlusOne<
  FindIndexForValue<$Value, $List>
> &
  number]

/**
 * Take all values before a given value in a tuple.
 *
 * @template $Value - The value to take values before
 * @template $List - The readonly tuple
 *
 * @example
 * ```ts
 * type T1 = Tup.TakeValuesBefore<'c', ['a', 'b', 'c', 'd']>  // ['a', 'b']
 * type T2 = Tup.TakeValuesBefore<'a', ['a', 'b', 'c']>       // []
 * type T3 = Tup.TakeValuesBefore<'x', ['a', 'b', 'c']>       // []
 * ```
 */
// oxfmt-ignore
export type TakeValuesBefore<$Value, $List extends readonly any[]> =
  $List extends readonly [infer $ListFirst, ...infer $ListRest]
    ? $Value extends $ListFirst
      ? []
      : [$ListFirst, ...TakeValuesBefore<$Value, $ListRest>]
    : []

/**
 * Find the value after a given value, or return a default.
 *
 * @template $Value - The value to find the successor of
 * @template $List - The non-empty readonly tuple
 * @template $OrValue - The default value if no successor exists
 *
 * @example
 * ```ts
 * type T1 = Tup.FindValueAfterOr<'b', ['a', 'b', 'c'], 'default'>  // 'c'
 * type T2 = Tup.FindValueAfterOr<'c', ['a', 'b', 'c'], 'default'>  // 'default'
 * ```
 */
export type FindValueAfterOr<$Value, $List extends readonly [any, ...any[]], $OrValue> = OrDefault<
  $List[Num.PlusOne<FindIndexForValue<$Value, $List>> & number],
  $OrValue
>

/**
 * Shallow merge all objects in a tuple from left to right.
 *
 * @template $Objects - The readonly tuple of objects to merge
 *
 * @example
 * ```ts
 * type T1 = Tup.ReduceObjectsMergeShallow<[{ a: 1 }, { b: 2 }]>        // { a: 1, b: 2 }
 * type T2 = Tup.ReduceObjectsMergeShallow<[{ a: 1 }, { a: 2, b: 3 }]>  // { a: 2, b: 3 }
 * ```
 */
// oxfmt-ignore
export type ReduceObjectsMergeShallow<$Objects extends readonly object[]> =
  $Objects extends readonly [infer __first__ extends object, ...infer __rest__ extends readonly object[]]
    ? __rest__ extends readonly []
      ? __first__
      // Shallow merge
      : & {
            readonly [__k__ in keyof __first__ as __k__ extends keyof __rest__[number] ? never : __k__]:
              __first__[__k__]
          }
        & ReduceObjectsMergeShallow<__rest__>
    : {}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Internal helper: Provide a default value if the type is `undefined`.
 * Used by GetNextIndexOr and FindValueAfterOr.
 */
type OrDefault<$Value, $Default> = $Value extends undefined ? $Default : $Value
