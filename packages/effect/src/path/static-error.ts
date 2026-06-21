/**
 * Compile-time error type used to surface path-validation failures as readable
 * TypeScript errors.
 *
 * Relocated from `@kitz/core`'s `Ts.Err.StaticError` during the `@kitz/effect`
 * consolidation. The branded `ERROR_______` / `CONTEXT_____` keys make the
 * failure legible at the call site.
 */

type NormalizeHierarchyInput<$H> = $H extends readonly string[]
  ? $H
  : $H extends string
    ? [$H]
    : readonly string[]

export interface StaticError<
  $HierarchyInput extends readonly string[] | string = readonly string[],
  $Context extends object = object,
> {
  ERROR_______: readonly [...NormalizeHierarchyInput<$HierarchyInput>, ...string[]]
  CONTEXT_____: $Context
}
