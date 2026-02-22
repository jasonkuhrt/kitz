---
name: creating-modules
description: Creates new modules within existing packages following project conventions. Handles file structure, barrel exports, namespace files, package.json imports/exports, and internal import patterns.
---

# Creating Modules

## Steps

1. **Create module directory**: `packages/<pkg>/src/<module-name>/`

2. **Create implementation files**: `<module-name>.ts` or split across multiple files

3. **Create barrel file** `__.ts` (if needed):
   ```typescript
   export * from './implementation.js'
   export * from './other-file.js'
   ```

   **CRITICAL: Prefer `export * from` in 99% of cases.** Named re-exports (`export { Foo } from`) add maintenance burden and can drift. Only use named exports when you need to:
   - Rename on export (`export { Foo as Bar }`)
   - Exclude specific exports (use `export *` then shadow with explicit export)

   **Elision rule**: When `__.ts` would only export from ONE file, skip `__.ts` entirely and have `_.ts` export directly from the implementation file.

4. **Create namespace file** `_.ts`:
   ```typescript
   // When __.ts exists (multiple source files):
   export * as ModuleName from './__.js'

   // When __.ts is elided (single source file):
   export * as ModuleName from './module-name.js'
   ```

5. **Add to package.json imports**:
   ```json
   {
     "imports": {
       "#module-name": "./build/module-name/_.js",
       "#module-name/*": "./build/module-name/*.js"
     }
   }
   ```

6. **Add to package.json exports**:
   ```json
   {
     "exports": {
       // When __.ts exists:
       "./module-name": "./build/module-name/__.js",
       // When __.ts is elided:
       "./module-name": "./build/module-name/module-name.js"
     }
   }
   ```

7. **Sync tsconfig paths** (run `syncing-tsconfig-paths` skill script)

8. **Add to main exports** in `src/__.ts`:
   ```typescript
   export * from '#module-name'
   ```

## Reference

### Module Structure

```
# Single source file (__.ts elided):
src/module-name/
├── _.ts              # Namespace: export * as ModuleName from './module-name.js'
├── _.test.ts         # Module tests
└── module-name.ts    # Implementation

# Multiple source files:
src/module-name/
├── _.ts              # Namespace: export * as ModuleName from './__.js'
├── _.test.ts         # Module tests
├── __.ts             # Barrel: export * from './impl.js'; export * from './other.js'
└── *.ts              # Implementation files
```

### Import System

**Within a package** - use `#` imports:

```typescript
// ✅ Correct - use # imports internally
import { Fn } from '#fn'
import { Obj } from '#obj'

// ❌ Incorrect - don't use relative or package imports internally
import { Obj } from '@kitz/core/obj'
import { Fn } from '../fn/_.js'
```

**Cross-package imports** - ALWAYS use namespace (root path), never barrel (`/__`):

```typescript
// ✅ Correct - namespace import from root
import { Fs } from '@kitz/fs'
import { Git } from '@kitz/git'
import { Semver } from '@kitz/semver'

// ❌ Incorrect - barrel imports
import { Path } from '@kitz/fs/__'
import { Git } from '@kitz/git/__'
import * as Semver from '@kitz/semver/__'
```

Access members via the namespace (e.g., `Git.Git`, `Git.GitError`, `Semver.fromString()`).

**Exception**: The `kitz` aggregator package re-exports barrels to compose the umbrella package.

### Naming

- **Directory**: kebab-case (`group-by/`)
- **Namespace export**: PascalCase (`GroupBy`)
- **Functions**: camelCase, no namespace prefix (`by`, not `groupBy`)

## Notes

- Each package defines its own `#` imports in package.json
- Cross-package `#` imports are not valid - use package name imports
