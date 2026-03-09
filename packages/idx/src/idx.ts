import { Arr, Lang, Ts } from '@kitz/core'
import type { IsAny } from 'type-fest'

// todo: allow key to be given as a property name instead of a function.

/**
 * An indexed collection that provides O(1) key-based lookups while maintaining array ordering.
 *
 * @template $Item - The type of items stored in the collection
 * @template $Key - The type of keys used for lookups (derived from items or provided explicitly)
 */
export interface Idx<$Item = any, $Key = any> {
  /**
   * Retrieves an item by strict equality check against itself or if a key function is configured, then what that returns.
   *
   * @param item - The item to search for
   * @returns The found item or undefined if not found
   *
   * @example
   * const idx = Idx.create({ key: item => item.id })
   * idx.set({ id: 1, name: 'Alice' })
   * idx.get({ id: 1 }) // { id: 1, name: 'Alice' }
   */
  get(item: $Item): $Item | undefined

  /**
   * Adds or updates an item in the collection.
   * If an item with the same key already exists, it will be replaced.
   *
   * @param item - The item to add or update
   *
   * @example
   * idx.set({ id: 1, name: 'Alice' })
   * idx.set({ id: 1, name: 'Alice Updated' }) // Replaces the previous item
   */
  set(item: $Item): void

  /**
   * Removes an item from the collection by its value.
   * Uses sparse array internally for O(1) deletion.
   *
   * @param item - The item to remove
   * @returns true if the item was found and removed, false otherwise
   */
  delete(item: $Item): boolean

  /**
   * Retrieves an item by its key directly.
   *
   * @param key - The key to search for
   * @returns The found item or undefined if not found
   *
   * @example
   * const idx = Idx.create({ key: item => item.id })
   * idx.set({ id: 1, name: 'Alice' })
   * idx.getAt(1) // { id: 1, name: 'Alice' }
   */
  getAt(key: $Key): $Item | undefined

  /**
   * Adds or updates an item at a specific key.
   *
   * @param key - The key to set
   * @param item - The item to store at this key
   *
   * @example
   * idx.setAt('custom-key', { value: 42 })
   */
  setAt(key: $Key, item: $Item): void

  /**
   * Removes an item by its key.
   * Uses sparse array internally for O(1) deletion.
   *
   * @param key - The key of the item to remove
   * @returns true if the item was found and removed, false otherwise
   */
  deleteAt(key: $Key): boolean

  /**
   * Returns a compacted array of all items, preserving insertion order.
   * If deletions occurred, this triggers lazy compaction.
   *
   * @returns Array of all items in insertion order
   */
  toArray(): $Item[]

  /**
   * Returns a Map of all key-item pairs.
   * For WeakMap storage mode, this rebuilds the map from the array.
   *
   * @returns Map of keys to items
   */
  toMap(): Map<$Key, $Item>
}

/**
 * Configuration options for creating an Idx collection.
 */
export interface Options<$Item = any, $Key = any> {
  /**
   * Function to derive a key from an item.
   * If not provided, the item itself is used as the key.
   *
   * @example
   * { key: item => item.id }
   * { key: item => `${item.type}-${item.id}` }
   */
  key?: (item: $Item) => $Key

  /**
   * Storage mode for the internal key-item mapping.
   *
   * In general you shouldn't have to use this option.
   *
   * If the key type is known then the typings will force you to choose the related mode.
   * If your key is an object but you know you still don't want a weakMap then you can still
   * use 'map' with a @ts-expect-error directive.
   *
   * - map: Always use Map (all key types, prone to memory leaks)
   * - weakMap: Always use WeakMap (only object keys, allows garbage collection)
   * - auto: Automatically choose based on if the key value received is typeof === 'object' (excluding null) or not
   *
   * @default 'auto'
   */
  mode?: undefined | InferModeOptions<$Key>
}

export const Mode = {
  strong: 'strong',
  weak: 'weak',
  auto: 'auto',
} as const

export type Mode = (typeof Mode)[keyof typeof Mode]

export namespace Mode {
  export type strong = typeof Mode.strong
  export type weak = typeof Mode.weak
  export type auto = typeof Mode.auto
}

export namespace ModeFor {
  export type PrimitiveKey = Mode.strong | Mode.auto
  export type ObjectKey = Mode.weak | Mode.auto
  export type Unknown = Mode.strong | Mode.auto | Mode.weak
}

// oxfmt-ignore
export type InferModeOptions<$Key> =
  IsAny<$Key> extends true                                  ? ModeFor.Unknown :
  Ts.Union.IsHas<$Key, Lang.Primitive> extends true       ? ModeFor.PrimitiveKey :
  [$Key] extends [object]                                   ? ModeFor.ObjectKey :
                                                            // else
                                                              ModeFor.Unknown

/**
 * Creates a new indexed collection.
 *
 * @template item - The type of items to store
 * @template key - The type of keys for lookups
 * @param options - Configuration options
 * @returns A new Idx collection
 *
 * @example
 * // Simple usage with default key (item itself)
 * const idx = Idx.create<number>()
 * idx.set(42)
 *
 * @example
 * // With custom key function
 * const idx = Idx.create<User, number>({
 *   key: user => user.id
 * })
 *
 * @example
 * // Force WeakMap for garbage collection
 * const idx = Idx.create<MyObject>({
 *   mode: 'weakMap'
 * })
 */
export const create = <item, key>(options?: Options<item, key>): Idx<item, key> => {
  const array = Arr.create<item | undefined>()
  const deletedIndices = new Set<number>()
  let lowestDeletedIndex: number | null = null
  // For now, just use a simple memoization until Effect migration is complete
  const keyCache = new Map<item, key>()
  const itemToKey = options?.key
    ? (item: item): key => {
        if (keyCache.has(item)) {
          return keyCache.get(item)!
        }
        const result = options.key!(item)
        keyCache.set(item, result)
        return result
      }
    : null

  type MapAsMap = Map<key, { item: item; index: number }>
  type MapAsWeakMap = WeakMap<any, { item: item; index: number }>

  // Storage initialization - may be lazy
  let map: MapAsMap | MapAsWeakMap | null = null
  let useWeakMap: boolean | null = null

  // Initialize storage based on mode
  if (options?.mode === Mode.strong) {
    map = new Map()
    useWeakMap = false
  } else if (options?.mode === Mode.weak) {
    map = new WeakMap()
    useWeakMap = true
  }
  // For 'auto' or undefined, we'll initialize on first use

  const initializeMap = (key: key) => {
    if (map === null) {
      // Auto-detect based on first key type
      const keyType = typeof key
      useWeakMap = keyType === 'object' && key !== null
      map = useWeakMap ? new WeakMap() : new Map()
    }
  }

  const index: Idx<item, key> = {
    get(item) {
      const key = (itemToKey?.(item) ?? item) as key
      return index.getAt(key)
    },
    set(item) {
      const key = (itemToKey?.(item) ?? item) as key
      index.setAt(key, item)
    },
    getAt(key) {
      if (map === null) return undefined
      return map.get(key)?.item
    },
    setAt(key, item) {
      initializeMap(key)
      const existing = map!.get(key)
      if (existing) {
        existing.item = item
        array.splice(existing.index, 1, item)
      } else {
        const index = array.push(item) - 1
        map!.set(key, { item, index })
      }
    },
    delete(item) {
      const key = (itemToKey?.(item) ?? item) as key
      return index.deleteAt(key)
    },
    deleteAt(key) {
      if (map === null) return false
      const entry = map.get(key)
      if (!entry) return false

      array[entry.index] = undefined
      deletedIndices.add(entry.index)

      // Track lowest deleted index
      if (lowestDeletedIndex === null || entry.index < lowestDeletedIndex) {
        lowestDeletedIndex = entry.index
      }

      map.delete(key)
      return true
    },
    toArray() {
      // Only compact if there were deletions
      const isNeedsCompaction = deletedIndices.size > 0
      if (!isNeedsCompaction) return array as item[]

      // Start with intact prefix up to first deletion
      const compactedArray = array.slice(0, lowestDeletedIndex ?? 0) as item[]
      const sparseToCompacted = new Map<number, number>()

      // Map all indices in the intact prefix
      for (let i = 0; i < compactedArray.length; i++) {
        sparseToCompacted.set(i, i)
      }

      // Build rest of array and index mapping
      const startIndex = lowestDeletedIndex ?? 0
      for (let i = startIndex; i < array.length; i++) {
        if (!deletedIndices.has(i) && array[i] !== undefined) {
          sparseToCompacted.set(i, compactedArray.length)
          compactedArray.push(array[i]!)
        }
      }

      return compactedArray

      // todo: should we spend the extra cpu to update the internal state with compaction result?
      // Update map with new indices
      // if (map && map instanceof Map) {
      //   map.forEach((entry) => {
      //     entry.index = oldToNewIndex.get(entry.index)!
      //   })
      // }

      // Replace array and clear deleted indices
      // array.length = 0
      // array.push(...newArray)
      // deletedIndices.clear()
      // lowestDeletedIndex = null
    },
    // todo: split tracking keyed item and keyed index so that in this function
    // we can just return the map without rebuilding it
    toMap() {
      // Handle different storage scenarios
      const dataMap = new Map<key, item>()

      if (map === null) {
        // No items have been added yet
        return dataMap
      }

      // For WeakMap mode, rebuild a Map from the array for the data getter
      if (useWeakMap) {
        for (let i = 0; i < array.length; i++) {
          if (!deletedIndices.has(i) && array[i] !== undefined) {
            const item = array[i]!
            const key = (itemToKey?.(item) ?? item) as key
            dataMap.set(key, item)
          }
        }
      } else {
        for (const [key, { item }] of map as MapAsMap) {
          dataMap.set(key, item)
        }
      }
      return dataMap
    },
  }

  return index as any
}

/**
 * Creates an indexed collection from an array of items.
 *
 * @template item - The type of items in the array
 * @template key - The type of keys for lookups
 * @param items - Array of items to index
 * @param options - Configuration options
 * @returns A new Idx collection containing all items
 *
 * @example
 * // From array of numbers
 * const idx = Idx.fromArray([1, 2, 3])
 *
 * @example
 * // From array of objects with key function
 * const users = [
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' }
 * ]
 * const idx = Idx.fromArray(users, { key: user => user.id })
 * idx.getAt(1) // { id: 1, name: 'Alice' }
 */
// todo: fromIterable?
export const fromArray = <item, key extends PropertyKey>(
  items: item[],
  options?: Options<item, key>,
): Idx<item, key> => {
  const index = create(options)

  // Note: We build the index eagerly here. For very large datasets, a lazy approach
  // could defer index building until first key-based access. However, the overhead
  // of tracking partial index state often outweighs the benefits, especially since
  // most use cases will eventually access the full dataset anyway.
  for (const item of items) {
    index.set(item)
  }

  return index
}
