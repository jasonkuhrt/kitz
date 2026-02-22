---
name: kitz-services
description: This skill should be used when creating Effect services, organizing service implementations (live, memory), structuring service modules, or refactoring services with multiple implementations.
---

# Effect Services

Convention for organizing Effect services with multiple implementations.

## Steps

1. **Assess size**: Count total files (service + implementations + models)
2. **Choose structure**: Flat (< 8 files) or nested (8+ files)
3. **Create files** following naming convention below

## Reference

### Flat Structure (< 8 files)

```
src/
├── _.ts              # Namespace export
├── __.ts             # Barrel file
├── service.ts        # Tag + interface + errors
├── live.ts           # Live implementation (wraps external lib)
├── memory.ts         # Memory implementation (for testing)
├── {model}.ts        # Data types (e.g., author.ts, commit.ts)
└── _.test.ts         # Tests
```

### Nested Structure (8+ files)

```
src/
├── _.ts
├── __.ts
├── service/
│   ├── _.ts          # Namespace export for service
│   ├── __.ts         # Barrel for service
│   ├── service.ts    # Tag + interface + errors
│   ├── live.ts       # Live implementation
│   └── memory.ts     # Memory implementation
└── models/
    ├── _.ts          # Namespace export for models
    ├── __.ts         # Barrel for models
    ├── author.ts
    └── commit.ts
```

### File Contents

**service.ts** - Service definition:

```typescript
import { Context, Effect } from 'effect'

// Errors
export const MyServiceError = Err.TaggedContextualError('MyServiceError')...
export type MyServiceError = InstanceType<typeof MyServiceError>

// Interface
export interface MyServiceImpl {
  readonly doThing: () => Effect.Effect<Result, MyServiceError>
}

// Tag
export class MyService extends Context.Tag('MyService')<MyService, MyServiceImpl>() {}
```

**live.ts** - Live implementation:

```typescript
import { Layer } from 'effect'
import { MyService, type MyServiceImpl } from './service.js'

const makeService = (deps: ExternalDeps): MyServiceImpl => ({
  doThing: () => Effect.tryPromise({...})
})

export const MyServiceLive = Layer.sync(MyService, () => makeService(createDeps()))
```

**memory.ts** - Test implementation:

```typescript
import { Effect, Layer, Ref } from 'effect'
import { MyService, type MyServiceImpl } from './service.js'

export interface MyServiceMemoryConfig {/* initial state */}
export interface MyServiceMemoryState {/* refs for verification */}

export const make = (config?: MyServiceMemoryConfig): Layer.Layer<MyService> =>
  Layer.effect(
    MyService,
    Effect.gen(function*() {
      const state = yield* makeState(config)
      return makeService(state)
    }),
  )
```

### Naming Convention

| File         | Contains                      |
| ------------ | ----------------------------- |
| `service.ts` | Tag, interface, errors        |
| `live.ts`    | Production implementation     |
| `memory.ts`  | In-memory test implementation |
| `{model}.ts` | Domain models/data types      |

## Notes

- **Never name a file after the module** (e.g., `git.ts` in `packages/git/`) - it's redundant
- Service tag name should match the module name (e.g., `Git` tag in `@kitz/git`)
- Memory implementations expose state refs for test verification
- Live implementations wrap external libraries (simple-git, database clients, etc.)
