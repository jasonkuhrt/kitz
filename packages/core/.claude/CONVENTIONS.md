# Core Package Conventions

Package-specific development conventions for `@kitz/core`.

## Effect/Non-Effect Function Pairs

When a function needs both Effect-native and immediate-execution versions, use the `*Unsafe` suffix pattern:

| Version       | Suffix    | Returns     | Use case                            |
| ------------- | --------- | ----------- | ----------------------------------- |
| Effect-native | (none)    | `Effect<A>` | Composable in Effect pipelines      |
| Immediate     | `*Unsafe` | `A`         | CLI scripts, outside Effect context |

"Unsafe" means the function bypasses Effect's supervision - the side effect executes immediately rather than being tracked by the Effect runtime. This follows Effect's own convention (e.g., `UnsafeConsole`).

### Example

```typescript
import { Effect } from 'effect'

// Effect-native: composable, tracked by Effect runtime
export const log = (error: Error): Effect.Effect<void> =>
  Effect.sync(() => console.log(inspect(error)))

// Immediate execution: for use outside Effect context
export const logUnsafe = (error: Error): void => {
  console.log(inspect(error))
}
```

### When to Create Pairs

Only create both versions when there's a genuine need:

- The function performs side effects (I/O, logging, mutation)
- It will be used both in Effect pipelines AND in non-Effect contexts (CLI entry points, scripts)

Pure functions don't need this pattern - they work in both contexts naturally.

## Effect as Optional Peer Dependency

`@kitz/core` has Effect as an optional peer dependency. Modules that use Effect should:

- Import Effect types/functions normally
- Document Effect dependency in the module's JSDoc if non-obvious
- Provide `*Unsafe` alternatives for side-effectful operations when needed outside Effect
