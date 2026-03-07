/**
 * Transform both keys and values of an object.
 *
 * @param obj - The object to transform
 * @param fn - Function that receives key and value, returns new [key, value] tuple
 * @returns A new object with transformed entries
 *
 * @example
 * ```ts
 * const obj = { a: 1, b: 2 }
 * Obj.mapEntries(obj, (k, v) => [k.toUpperCase(), v * 2])
 * // { A: 2, B: 4 }
 * ```
 */
export const mapEntries = <
  $Obj extends Record<string, unknown>,
  $NewKey extends PropertyKey,
  $NewValue,
>(
  obj: $Obj,
  fn: (key: keyof $Obj & string, value: $Obj[keyof $Obj & string]) => readonly [$NewKey, $NewValue],
): Record<$NewKey, $NewValue> => {
  const result = {} as Record<$NewKey, $NewValue>
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const [newKey, newValue] = fn(key, obj[key] as $Obj[keyof $Obj & string])
      result[newKey] = newValue
    }
  }
  return result
}

/**
 * Transform the keys of an object while keeping values unchanged.
 *
 * @param obj - The object to transform
 * @param fn - Function that receives key and value, returns new key
 * @returns A new object with transformed keys
 *
 * @example
 * ```ts
 * const obj = { firstName: 'Alice', lastName: 'Smith' }
 * Obj.mapKeys(obj, k => k.toUpperCase())
 * // { FIRSTNAME: 'Alice', LASTNAME: 'Smith' }
 * ```
 *
 * @example
 * ```ts
 * // Access value in the mapper
 * const obj = { a: 1, b: 2 }
 * Obj.mapKeys(obj, (k, v) => `${k}_${v}`)
 * // { a_1: 1, b_2: 2 }
 * ```
 */
export const mapKeys = <$Obj extends Record<string, unknown>, $NewKey extends PropertyKey>(
  obj: $Obj,
  fn: (key: keyof $Obj & string, value: $Obj[keyof $Obj & string]) => $NewKey,
): Record<$NewKey, $Obj[keyof $Obj & string]> => {
  const result = {} as Record<$NewKey, $Obj[keyof $Obj & string]>
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key] as $Obj[keyof $Obj & string]
      result[fn(key, value)] = value
    }
  }
  return result
}
