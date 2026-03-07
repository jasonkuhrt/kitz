import type { State } from './state.js'

/**
 * Update state with partial updates, merging shallowly.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type MyState = { name: string; count: number }
 * type Updated = UpdateState<MyState, { count: 5 }>
 * // Result: { name: string; count: 5 }
 * ```
 */
export type UpdateState<$State extends State, $Updates extends Partial<$State>> = {
  [K in keyof $State]: K extends keyof $Updates ? $Updates[K] : $State[K]
}

/**
 * Add an item to an array in state.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type MyState = { items: string[] }
 * type Updated = AddToArray<MyState, 'items', 'newItem'>
 * // Result: { items: [...string[], 'newItem'] }
 * ```
 */
export type AddToArray<
  $State extends State,
  $Key extends keyof $State,
  $Item,
> = $State[$Key] extends readonly (infer __element__)[]
  ? {
      [K in keyof $State]: K extends $Key ? [...__element__[], $Item] : $State[K]
    }
  : never

/**
 * Set a specific field in state.
 *
 * @category Type Utilities
 *
 * @example
 * ```ts
 * type MyState = { name: string; count: number }
 * type Updated = SetField<MyState, 'name', 'NewName'>
 * // Result: { name: 'NewName'; count: number }
 * ```
 */
export type SetField<$State extends State, $Key extends keyof $State, $Value> = {
  [K in keyof $State]: K extends $Key ? $Value : $State[K]
}
