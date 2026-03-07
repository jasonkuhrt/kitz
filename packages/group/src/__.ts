import { Obj, Ts, Undefined } from '@kitz/core'
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Types - Immutable (default)

/**
 * Unknown readonly group set type. Use as a constraint for immutable group sets.
 */
export type Unknown = Readonly<Record<PropertyKey, readonly unknown[]>>

/**
 * Any readonly group set type. Use as a constraint for immutable group sets.
 */
export type Any = Readonly<Record<PropertyKey, readonly any[]>>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Types - Mutable (explicit)

/**
 * Unknown mutable group set type.
 */
export type UnknownMut = Record<PropertyKey, unknown[]>

/**
 * Any mutable group set type.
 */
export type AnyMut = Record<PropertyKey, any[]>

// oxfmt-ignore
export type by<
  $Type extends object,
  $Key extends keyof $Type,
> =
  object extends $Type
    ? Any
    : $Type[$Key] extends PropertyKey
        ? Readonly<{
            [__group_name__ in $Type[$Key]]?:
            readonly (
              // If $Type is a union type we want to extract the relevent members for this group.
              //
              // If Extraction results in never then that means its not a union of types but rather
              // the key value itself is a union. In this case each group  gets the type but narrowed
              // for the key property.
              //
              Ts.Simplify.Top<
                Extract<$Type, { [_ in $Key]: __group_name__ }> extends never
                  ? $Type & { [_ in $Key]: __group_name__ }
                  : Extract<$Type, { [_ in $Key]: __group_name__ }>
              >
            )[]
          }>
        : never

/**
 * Result type for grouping objects using a function keyer.
 */
// oxfmt-ignore
export type byFn<
  $Type extends object,
  $Key extends PropertyKey,
> =
  object extends $Type
    ? Any
    : string extends $Key
        // Wide string type: fall back to Record
        ? Readonly<Record<string, readonly $Type[]>>
        : Readonly<{
            [__group_name__ in $Key]?: readonly $Type[]
          }>

// oxfmt-ignore
export type byToMut<
  $Type extends object,
  $Key extends keyof $Type,
> =
  object extends $Type
    ? AnyMut
    : $Type[$Key] extends PropertyKey
        ? {
            [__group_name__ in $Type[$Key]]?:
            Array<
              (
                // If $Type is a union type we want to extract the relevent members for this group.
                //
                // If Extraction results in never then that means its not a union of types but rather
                // the key value itself is a union. In this case each group  gets the type but narrowed
                // for the key property.
                //
                Ts.Simplify.Top<
                  Extract<$Type, { [_ in $Key]: __group_name__ }> extends never
                    ? $Type & { [_ in $Key]: __group_name__ }
                    : Extract<$Type, { [_ in $Key]: __group_name__ }>
                >
              )
            >
          }
        : never

/**
 * Result type for grouping objects using a function keyer (mutable).
 */
// oxfmt-ignore
export type byFnToMut<
  $Type extends object,
  $Key extends PropertyKey,
> =
  object extends $Type
    ? AnyMut
    : string extends $Key
        // Wide string type: fall back to Record
        ? Record<string, $Type[]>
        : {
            [__group_name__ in $Key]?: $Type[]
          }

// oxfmt-ignore
export interface ErrorInvalidGroupKey<obj extends object, key extends keyof obj> extends Ts.Err.StaticError<
  readonly ['group', 'invalid-key'],
  {
    message: `The value at your chosen key ${Ts.Show<key>} is not a subtype of allowed property key types (${Ts.Show<PropertyKey>}) and so cannot be used to group your objects.`
    your_key_type: obj[key]
  }
> {}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Clone & Immutability

/**
 * Deep immutable type for a group set.
 * Makes both the root object and all bucket arrays readonly.
 *
 * @category Clone
 */
export type toImmutable<$Group extends AnyMut> = Readonly<{
  [K in keyof $Group]: Readonly<$Group[K]>
}>

/**
 * Deep mutable type for a group set.
 * Removes readonly from both the root object and all bucket arrays.
 *
 * @category Clone
 */
export type cloneToMut<$Group extends Any> = {
  -readonly [K in keyof $Group]: $Group[K] extends readonly (infer T)[] ? T[] : $Group[K]
}

/**
 * Create a structure-aware clone of a group set, preserving its immutability state.
 * Clones both the root object and all bucket arrays.
 *
 * @category Clone
 *
 * @param group - The group set to clone
 * @returns A new group set with the same immutability state as the input
 *
 * @example
 * ```ts
 * const frozen = Group.by(users, 'role')
 * const frozenClone = Group.clone(frozen)
 * // frozenClone is frozen (root + all buckets)
 * ```
 */
export const clone = <$Group extends Any>(group: $Group): $Group => {
  const result: AnyMut = {}
  for (const k in group) {
    result[k] = [...(group[k] as any[])]
  }
  return (Object.isFrozen(group) ? toImmutableMut(result) : result) as $Group
}

/**
 * Create a structure-aware mutable clone of a group set.
 * Always returns a mutable clone regardless of input's frozen state.
 *
 * @category Clone
 *
 * @param group - The group set to clone
 * @returns A new mutable group set (root + all buckets unfrozen)
 *
 * @example
 * ```ts
 * const frozen = Group.by(users, 'role')
 * const mutable = Group.cloneToMut(frozen)
 * // mutable is NOT frozen, can push to buckets
 * mutable.admin.push(newAdmin)
 * ```
 */
export const cloneToMut = <$Group extends Any>(group: $Group): cloneToMut<$Group> => {
  const group_: AnyMut = {}
  for (const k in group) {
    group_[k] = [...(group[k] as any[])]
  }
  return group_ as cloneToMut<$Group>
}

/**
 * Create a frozen clone of a group set.
 * Clones then deep freezes (root + all bucket arrays).
 *
 * @category Clone
 *
 * @param group - The group set to clone and freeze
 * @returns A new frozen group set
 *
 * @example
 * ```ts
 * const mutable = Group.byMut(users, 'role')
 * const frozen = Group.toImmutable(mutable)
 * // frozen is frozen (root + all buckets), mutable unchanged
 * ```
 */
export const toImmutable = <$Group extends AnyMut>(group: $Group): toImmutable<$Group> => {
  if (Object.isFrozen(group)) return group as any
  const result: AnyMut = {}
  for (const k in group) {
    result[k] = Obj.toImmutableMut([...(group[k] as any[])]) as any
  }
  return Obj.toImmutableMut(result) as any
}

/**
 * Deep freeze a group set in place.
 * Freezes both the root object and all bucket arrays.
 *
 * @category Clone
 *
 * @param group - The group set to freeze in place
 * @returns The same group set, now frozen (root + all buckets)
 *
 * @example
 * ```ts
 * const group = Group.byMut(users, 'role')
 * Group.toImmutableMut(group)
 * // group is now frozen (root + all buckets)
 * ```
 */
export const toImmutableMut = <$Group extends AnyMut>(group: $Group): toImmutable<$Group> => {
  for (const k in group) {
    Obj.toImmutableMut(group[k] as any[])
  }
  return Obj.toImmutableMut(group) as toImmutable<$Group>
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Construction

/**
 * Groups an array of objects by the value at a specified key, returning a mutable group set.
 *
 * Creates a mutable index where each unique value at the given key becomes a property
 * containing a mutable array of all objects that have that value.
 *
 * @param array - The array of objects to group
 * @param key - The object key whose values will be used for grouping. Must be a valid property key type (string, number, or symbol)
 * @returns A mutable object where keys are the unique values found at the specified key, and values are mutable arrays of objects
 *
 * @example
 * const users = [
 *   { id: 1, role: 'admin', name: 'Alice' },
 *   { id: 2, role: 'user', name: 'Bob' }
 * ]
 *
 * const usersByRole = Group.byMut(users, 'role')
 * // Result (mutable):
 * // {
 * //   admin: [{ id: 1, role: 'admin', name: 'Alice' }],
 * //   user: [{ id: 2, role: 'user', name: 'Bob' }]
 * // }
 * // Can be mutated:
 * usersByRole.admin.push({ id: 3, role: 'admin', name: 'Charlie' })
 */
export function byToMut<$Obj extends object, $Key extends keyof $Obj>(
  array: $Obj[],
  // oxfmt-ignore
  key: ValidateIsGroupableKey<$Obj, $Key, ErrorInvalidGroupKey<$Obj, $Key>>,
): byToMut<$Obj, $Key>

/**
 * Groups an array of objects using a function keyer, returning a mutable group set.
 *
 * @param array - The array of objects to group
 * @param keyer - A function that returns the group key for each object
 * @returns A mutable object where keys are the return values of the keyer function
 *
 * @example
 * const items = [
 *   { name: 'apple', category: 'fruit' },
 *   { name: 'carrot', category: 'vegetable' }
 * ]
 *
 * const byCategory = Group.byToMut(items, item => item.category)
 * // Result (mutable):
 * // {
 * //   fruit: [{ name: 'apple', category: 'fruit' }],
 * //   vegetable: [{ name: 'carrot', category: 'vegetable' }]
 * // }
 */
export function byToMut<$Obj extends object, $Key extends string | number | symbol>(
  array: $Obj[],
  keyer: (item: $Obj) => $Key,
): byFnToMut<$Obj, $Key>

export function byToMut<$Obj extends object>(
  array: $Obj[],
  keyOrKeyer: PropertyKey | ((item: $Obj) => PropertyKey),
): AnyMut {
  const groupSet = array.reduce(
    (index, item) => {
      const indexKey =
        typeof keyOrKeyer === `function`
          ? keyOrKeyer(item)
          : ((item as any)[keyOrKeyer] as PropertyKey)
      index[indexKey] ??= []
      index[indexKey].push(item)
      return index
    },
    {} as Record<PropertyKey, any[]>,
  )

  return groupSet
}

/**
 * Groups an array of objects by the value at a specified key.
 *
 * Creates a frozen (immutable) index where each unique value at the given key becomes a property
 * containing a frozen array of all objects that have that value.
 *
 * @param array - The array of objects to group
 * @param key - The object key whose values will be used for grouping. Must be a valid property key type (string, number, or symbol)
 * @returns A frozen object where keys are the unique values found at the specified key, and values are frozen arrays of objects
 *
 * @example
 * const users = [
 *   { id: 1, role: 'admin', name: 'Alice' },
 *   { id: 2, role: 'user', name: 'Bob' },
 *   { id: 3, role: 'admin', name: 'Charlie' }
 * ]
 *
 * const usersByRole = Group.by(users, 'role')
 * // Result (frozen):
 * // {
 * //   admin: [{ id: 1, role: 'admin', name: 'Alice' }, { id: 3, role: 'admin', name: 'Charlie' }],
 * //   user: [{ id: 2, role: 'user', name: 'Bob' }]
 * // }
 *
 * @example
 * // Grouping by numeric keys
 * const items = [
 *   { categoryId: 1, name: 'Laptop' },
 *   { categoryId: 2, name: 'Mouse' },
 *   { categoryId: 1, name: 'Keyboard' }
 * ]
 *
 * const itemsByCategory = Group.by(items, 'categoryId')
 * // Result (frozen):
 * // {
 * //   1: [{ categoryId: 1, name: 'Laptop' }, { categoryId: 1, name: 'Keyboard' }],
 * //   2: [{ categoryId: 2, name: 'Mouse' }]
 * // }
 */
export function by<$Obj extends object, $Key extends keyof $Obj>(
  array: $Obj[],
  // oxfmt-ignore
  key: ValidateIsGroupableKey<$Obj, $Key, ErrorInvalidGroupKey<$Obj, $Key>>,
): by<$Obj, $Key>

/**
 * Groups an array of objects using a function keyer.
 *
 * Creates a frozen (immutable) index where each unique return value of the keyer
 * becomes a property containing a frozen array of all objects with that key.
 *
 * @param array - The array of objects to group
 * @param keyer - A function that returns the group key for each object
 * @returns A frozen object where keys are the return values of the keyer function
 *
 * @example
 * const items = [
 *   { name: 'apple', category: 'fruit' },
 *   { name: 'carrot', category: 'vegetable' }
 * ]
 *
 * const byCategory = Group.by(items, item => item.category)
 * // Result (frozen):
 * // {
 * //   fruit: [{ name: 'apple', category: 'fruit' }],
 * //   vegetable: [{ name: 'carrot', category: 'vegetable' }]
 * // }
 *
 * @example
 * // With literal union return type for precise typing
 * type Status = 'active' | 'inactive'
 * const users = [
 *   { name: 'Alice', status: 'active' as Status },
 *   { name: 'Bob', status: 'inactive' as Status }
 * ]
 *
 * const byStatus = Group.by(users, (u): Status => u.status)
 * // Type: { active?: readonly User[], inactive?: readonly User[] }
 */
export function by<$Obj extends object, $Key extends string | number | symbol>(
  array: $Obj[],
  keyer: (item: $Obj) => $Key,
): byFn<$Obj, $Key>

export function by<$Obj extends object>(
  array: $Obj[],
  keyOrKeyer: PropertyKey | ((item: $Obj) => PropertyKey),
): Any {
  const groupSet = byToMut(array, keyOrKeyer as any) as AnyMut
  return toImmutableMut(groupSet)
}

type ValidateIsGroupableKey<
  $Obj extends object,
  $Key extends keyof $Obj,
  $Error extends Ts.Err.StaticError,
> = $Obj[$Key] extends PropertyKey ? $Key : Ts.Simplify.Top<$Error>

/**
 * Merges two group sets together.
 *
 * Combines the arrays for each group key. If a key exists in both groups,
 * the arrays are concatenated with group2's items appended to group1's items.
 *
 * Immutability mode is inferred from inputs (OR logic):
 * - If EITHER input is frozen: returns a new frozen group set
 * - If BOTH inputs are mutable: mutates group1 in place and returns it
 *
 * @template groupSet - The type of the group set
 * @param group1 - The first group set (mutated in place if both inputs are mutable)
 * @param group2 - The second group set to merge
 * @returns The merged group set (frozen if either input was frozen, otherwise group1)
 */
export const merge = <$groupSet extends Any>(group1: $groupSet, group2: $groupSet): $groupSet => {
  const mode = Obj.inferImmutabilityMode(group1, group2)
  const isMut = mode === 'mutable'
  const result: AnyMut = isMut ? (group1 as any) : {}

  // Copy group1 arrays only if immutable mode
  if (!isMut) {
    for (const k in group1) result[k] = [...(group1[k] as any[])]
  }

  // Merge group2
  for (const k in group2) {
    if (result[k]) {
      if (isMut) {
        ;(result[k] as any[]).push(...(group2[k] as any[]))
      } else {
        result[k] = [...result[k], ...(group2[k] as any[])]
      }
    } else {
      result[k] = [...(group2[k] as any[])]
    }
  }

  return (isMut ? result : toImmutableMut(result)) as any
}

export type Mapper<$GroupSet extends Any> = {
  [__group_name__ in keyof $GroupSet]: (
    value: Undefined.Exclude<$GroupSet[__group_name__]>,
  ) => unknown
}

export type map<$GroupSet extends Any, $Mapper extends Mapper<$GroupSet>> = {
  [__group_name__ in keyof $GroupSet]: ReturnType<$Mapper[__group_name__]>
}

/**
 * Maps over each group in a group set, transforming the arrays with provided handler functions.
 *
 * Each handler receives the array of items for its corresponding group.
 *
 * Immutability mode is inferred from input:
 * - If input is frozen: returns a new frozen group set
 * - If input is mutable: transforms in place and returns the same group set
 *
 * @template groupSet - The type of the group set
 * @template handlers - The type of the handler functions object
 * @param groupSet - The group set to map over (mutated in place if mutable)
 * @param handlers - An object where keys match group keys and values are transformation functions
 * @returns The transformed group set (frozen if input was frozen, otherwise the same mutable input)
 * @throws {Error} If a handler is not provided for a group key that exists in the group set
 */
export function map<groupSet extends Any, handlers extends Mapper<groupSet>>(
  groupSet: groupSet,
  handlers: handlers,
): Ts.Simplify.Top<map<groupSet, handlers>> {
  const isMut = !Obj.isImmutable(groupSet)
  const result: AnyMut = isMut ? (groupSet as any) : {}

  for (const groupName in groupSet) {
    const handler = handlers[groupName]
    if (!handler) throw new Error(`No handler for group "${groupName}"`)
    result[groupName] = handler(groupSet[groupName] as any) as any
  }

  return (isMut ? result : toImmutableMut(result)) as any
}
