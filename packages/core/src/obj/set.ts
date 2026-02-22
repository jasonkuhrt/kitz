import type { Ts } from '#ts'
import type { Undefined } from '#undefined'

/**
 * Replace the type of a specific key in an object.
 * The new type must be assignable to the original type.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { id: number; name: string; status: 'active' | 'inactive' }
 * type Updated = SetKey<User, 'status', 'active'>
 * // Result: { id: number; name: string; status: 'active' }
 * ```
 */
export type SetKey<
  $Obj extends object,
  $PropertyName extends keyof $Obj,
  $Type extends $Obj[$PropertyName],
> =
  & {
    [k in keyof $Obj as k extends $PropertyName ? never : k]: $Obj[k]
  }
  & {
    [k in $PropertyName]: $Type
  }

/**
 * Replace the type of a specific key in an object without type constraint.
 * Allows setting any type, even if incompatible with original.
 * Use with caution - prefer {@link SetKey} when possible.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { id: number; name: string }
 * type Changed = SetKeyUnsafe<User, 'id', string>
 * // Result: { id: string; name: string }
 * ```
 */
export type SetKeyUnsafe<
  $Obj extends object,
  $PropertyName extends keyof $Obj,
  $Type,
> =
  & {
    [k in keyof $Obj as k extends $PropertyName ? never : k]: $Obj[k]
  }
  & {
    [k in $PropertyName]: $Type
  }

/**
 * Set a value at a nested path in an object type.
 * Creates intermediate objects if the path doesn't exist.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type Config = { db: { host: string; port: number } }
 * type Updated = SetAtPath<Config, ['db', 'port'], 5432>
 * // Result: { db: { host: string; port: 5432 } }
 *
 * type Extended = SetAtPath<Config, ['db', 'ssl'], boolean>
 * // Result: { db: { host: string; port: number; ssl: boolean } }
 * ```
 */
// dprint-ignore
export type SetAtPath<
  $Object extends object,
  $Path extends readonly string[],
  $Value,
> =
  $Path extends []
    ? $Object
    : $Path extends [infer __key__ extends string, ...infer __rest__ extends string[]]
      ? __rest__ extends []
        ? Omit<$Object, __key__> & { [k in __key__]: $Value }
        : __key__ extends keyof $Object
          ? $Object[__key__] extends object
            ? Omit<$Object, __key__> & { [k in __key__]: SetAtPath<$Object[__key__], __rest__, $Value> }
            : Omit<$Object, __key__> & { [k in __key__]: SetAtPath<{}, __rest__, $Value> }
        : $Object & { [k in __key__]: SetAtPath<{}, __rest__, $Value> }
      : never

/**
 * Set a value at a nested path, with simplified output type.
 * Similar to {@link SetAtPath} but applies type simplification.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type State = { user: { name: string } }
 * type Updated = SetKeyAtPath<State, ['user', 'name'], 'Alice'>
 * // Result: { user: { name: 'Alice' } }
 * ```
 */
// dprint-ignore
export type SetKeyAtPath<$Obj extends object, $Path extends readonly string[], $Value> =
  Ts.Simplify.Top<
    $Path extends []
      ? $Value extends object
        ? $Obj & $Value
        : never
      : SetKeyAtPath_<$Obj, $Path, $Value>
  >

// dprint-ignore
type SetKeyAtPath_<$ObjOrValue, $Path extends readonly string[], $Value> =
  Ts.Simplify.Top<
    $Path extends [infer __p1__ extends string, ...infer __pn__ extends string[]]
      ? __p1__ extends keyof $ObjOrValue
        ? Omit<$ObjOrValue, __p1__> & { [k in __p1__]: SetKeyAtPath_<$ObjOrValue[__p1__], __pn__, $Value> }
        : never
      : $Value
  >

/**
 * Set multiple values at different paths in an object type.
 * Applies each path/value pair in sequence.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type Config = { db: { host: string }; cache: { enabled: boolean } }
 * type Updated = SetMany<Config, [
 *   [['db', 'host'], 'localhost'],
 *   [['cache', 'enabled'], true]
 * ]>
 * ```
 */
// dprint-ignore
export type SetMany<$Obj extends object, $Sets extends [readonly string[], any][]> =
  $Sets extends []
    ? $Obj
    : $Sets extends [infer __set__ extends [readonly string[], any], ...infer __rest__ extends [readonly string[], any][]]
      ? SetMany<SetKeyAtPath<$Obj, __set__[0], __set__[1]>, __rest__>
      : never

/**
 * Set a batch of keys on an object, ignoring undefined values.
 * Only replaces keys that exist in the target object.
 * Undefined values in the batch are ignored (original value preserved).
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type User = { name: string; age: number; email: string }
 * type Updates = { name: 'Alice'; age: undefined }
 * type Updated = SetKeysOptional<User, Updates>
 * // Result: { name: 'Alice'; age: number; email: string }
 * // Note: age is unchanged because the update value is undefined
 * ```
 */
// dprint-ignore
export type SetKeysOptional<
  $Obj extends object,
  $NewObjValues extends object,
> = {
  [k in keyof $Obj]:
    k extends keyof $NewObjValues
      ? Undefined.Exclude<$NewObjValues[k]> extends never
        ? $Obj[k]
        : Undefined.Exclude<$NewObjValues[k]>
      : $Obj[k]
}

/**
 * Conditionally append a value to an array type.
 * If the value is undefined, returns the original array unchanged.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type T1 = AppendOptional<[1, 2], 3>  // [1, 2, 3]
 * type T2 = AppendOptional<[1, 2], undefined>  // [1, 2]
 * ```
 */
export type AppendOptional<$Array extends any[], $Value> = $Value extends undefined ? $Array : [...$Array, $Value]
