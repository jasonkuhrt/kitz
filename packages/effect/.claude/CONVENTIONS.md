# @kitz/fs Conventions

## Path Getters Are Sugar Over Exported Functions

Path class getters (`.name`, etc.) MUST delegate to exported functions. The exported functions are the source of truth.

> **Note**: We use exported functions rather than static methods because JS classes have a built-in `Function.name` property that conflicts with `static name()`.

### Why

1. **Tree-shaking**: Exported functions can be eliminated if unused
2. **Polymorphism**: Standalone functions dispatch to per-type functions via Match
3. **Testing**: Functions are easier to unit test in isolation
4. **Export visibility**: The internal class isn't exported, so statics wouldn't be accessible anyway

### Pattern

```typescript
// AbsFile/__.ts - exported function has the logic, getter delegates
class AbsFileClass extends S.TaggedClass<AbsFileClass>()('FsPathAbsFile', { ... }) {
  /** The filename including extension. */
  get name(): string {
    return name(this)
  }
}

/**
 * Get the filename including extension.
 */
export const name = (instance: AbsFileClass): string =>
  instance.fileName.extension
    ? instance.fileName.stem + instance.fileName.extension
    : instance.fileName.stem

// operations/name.ts - polymorphic function dispatches to per-type functions
export const name = (path: Path): string =>
  Match.value(path).pipe(
    Match.tagsExhaustive({
      FsPathAbsFile: AbsFile.name,
      FsPathRelFile: RelFile.name,
      FsPathAbsDir: AbsDir.name,
      FsPathRelDir: RelDir.name,
    }),
  )
```

### Anti-pattern

```typescript
// BAD - function calls getter (inverted dependency)
export const name = (path: Path): string => path.name

// BAD - duplicated logic in getter (not delegating to function)
get name(): string {
  return this.fileName.extension
    ? this.fileName.stem + this.fileName.extension
    : this.fileName.stem
}

// BAD - static method (conflicts with Function.name)
static name(instance: AbsFileClass): string { ... }
```
