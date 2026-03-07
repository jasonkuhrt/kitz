# Print.ts Current State Analysis

## File Location

`/Users/jasonkuhrt/projects/jasonkuhrt/kit/src/utils/ts/print.ts`

## Current Exports

### 1. `Print<$Type, $Fallback>` - Main Type Printing Utility

- **Type**: Conditional type that converts any TypeScript type to a readable string representation
- **Parameters**:
  - `$Type`: The type to print
  - `$Fallback extends string | undefined = undefined`: Fallback string for non-primitive types
- **Returns**: String representation of the type

**Current Type Handling** (in order):

1. `any` → `'any'`
2. `unknown` → `'unknown'`
3. `never` → `'never'`
4. `boolean` (special) → `'boolean'` if general, or `'true'`/`'false'` if literal
5. Union types → Recursively prints with `|` separator via `_PrintUnion`
6. Primitives:
   - String: `'string'` or `'literal-string'` if literal
   - Number: `'number'` or `'123'` if literal
   - Bigint: `'bigint'` or `'100n'` if literal
   - Boolean: `'true'` or `'false'`
   - Null/Undefined/Symbol/void
7. Common objects:
   - Promise<T> → `'Promise<${Print<T>}>'`
   - Array/ReadonlyArray → `'Array<...>'`/`'ReadonlyArray<...>'`
   - Date, RegExp, Function
8. General object → `'object'`
9. Ultimate fallback → `'?'`
10. **Fallback parameter** used if type doesn't match any pattern above

### 2. `_PrintUnion<$Type>` - Internal Helper

- **Type**: Internal union printer for recursive union handling
- Flattens tuple of union members into `'Type1 | Type2 | Type3'`

## Related: `Show` in ts.ts

**Location**: `src/utils/ts/ts.ts:186`

- **Type**: `Show<$Type> = \`\`${Print<$Type>}\`\``
- **Purpose**: Wraps Print output in backticks for markdown-like formatting
- **Variants**:
  - `Show<T>` - backtick wrapped (for markdown)
  - `ShowInTemplate<T>` - single-quote wrapped (for template literals where backticks get escaped)

## Show in err.ts

**Location**: `src/utils/ts/err.ts:167-180`

- **Type**: `Show<$Error extends StaticError, ...>`
- **Purpose**: Display a StaticError with formatted hierarchy and context
- **Features**:
  - Extracts hierarchy from error path
  - Pads keys to 14 characters for visual alignment
  - Simplifies context object
- **Used for**: Rendering type-level errors in IDE hovers

## Key Patterns in Codebase

### 1. Global Settings/Registry Pattern (in global-settings.ts)

- Uses `declare global { namespace KitLibrarySettings }` for extensibility
- Allows projects to augment behavior via declaration merging
- Examples:
  - `KitLibrarySettings.Ts.PreserveTypes` - Types to not expand
  - `KitLibrarySettings.Simplify.Traversables` - Custom type traversals
  - `KitLibrarySettings.Ts.Error.renderErrors` - Error display config

### 2. Recent Traits System Removal (Commit a76dd95)

- **When**: Nov 20, 2025
- **What was removed**: `Traitor` library and trait system
- **Pattern it was using**:
  ```typescript
  export const Eq = Traitor.implement(EqTrait, domain, {
    is(a, b) {
      /* implementation */
    },
  })
  ```
- **Why removed**: Complexity; could be replaced with simpler approaches
- Removed `src/traits/` and `src/domains/*/traits/` directories

### 3. No Type Registry Currently Exists

- `Print` handles types via hardcoded pattern matching
- `Show` in err.ts manually transforms error interfaces
- No dispatch mechanism or plugin system for custom type handling
- No "Show" trait exists (was removed with trait system)

## Test Coverage

**Location**: `src/utils/ts/print.test.ts`

- Uses `Type.exact.ofAs<Expected>().onAs<Actual>()` assertion API
- Tests organized by:
  - Primitives and Literals (string, number, boolean, bigint, null, undefined, symbol)
  - Common Object Types (Promise, Array, ReadonlyArray, Date, RegExp, Function)
  - General Object, any, unknown, never
  - Union Types
  - Fallback Parameter behavior

## Key Observations

1. **No extensibility currently**: Print is 100% hardcoded pattern matching
2. **Related `Show` functions serve different purposes**:
   - `Print` - Type to string conversion
   - `Show` (in ts.ts) - Adds markdown backtick wrapping
   - `Show` (in err.ts) - Formats StaticError objects
3. **Global settings pattern** exists for other features (PreserveTypes, Simplify.Traversables)
4. **Trait system was removed** - So no "Show trait" as pattern
5. **No "render hook" pattern** - Unlike global settings, no registry for custom type printers

## Current Test Examples

```typescript
// Primitives
Ts.Print<string> // 'string'
Ts.Print<'hello'> // "'hello'"
Ts.Print<number> // 'number'
Ts.Print<123> // '123'

// Objects
Ts.Print<Promise<string>> // 'Promise<string>'
Ts.Print<string[]> // 'Array<string>'
Ts.Print<readonly Date[]> // 'ReadonlyArray<Date>'

// Objects with fallback
Ts.Print<{ x: 1 }, 'CustomObject'> // 'CustomObject'
Ts.Print<Date, 'CustomDate'> // 'CustomDate'

// Unions
Ts.Print<number | null> // 'number | null' or 'null | number'
```

## Summary

Print.ts is a **pure type-level utility** for displaying types as strings. It uses hardcoded conditional type pattern matching and currently has no extensibility mechanism. Related `Show` functions exist elsewhere for different purposes (markdown wrapping, error formatting). The codebase uses global settings/registry patterns for other features but not for type printing.
