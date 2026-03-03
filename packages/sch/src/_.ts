/**
 * Schema utilities for Effect.
 *
 * Provides value-add utilities over Effect's Schema module including:
 * - Tagged struct utilities for discriminated unions
 * - ADT (Algebraic Data Type) detection and factory creation
 * - AST manipulation utilities for schema introspection
 * - Type-safe field extraction and literal utilities
 *
 * @example
 * ```ts
 * import { Sch } from '@kitz/sch'
 * import { Schema } from 'effect'
 *
 * // Create a discriminated union with factory
 * const Event = Schema.Union(
 *   Schema.TaggedStruct('UserCreated', { id: Schema.String, name: Schema.String }),
 *   Schema.TaggedStruct('UserDeleted', { id: Schema.String })
 * )
 *
 * const makeEvent = Sch.Union.makeMake(Event)
 *
 * // Type-safe event creation
 * const created = makeEvent('UserCreated', { id: '123', name: 'John' })
 * const deleted = makeEvent('UserDeleted', { id: '123' })
 *
 * // ADT detection
 * const tags = ['CatalogVersioned', 'CatalogUnversioned']
 * const adt = Sch.Union.parse(tags)
 * // { name: 'Catalog', members: [...] }
 * ```
 */
export * as Sch from './__.js'

/**
 * Namespace anchor for {@link Sch}.
 */
export namespace Sch {}
