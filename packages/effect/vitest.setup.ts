import { Equal } from 'effect'
import { expect } from 'vite-plus/test'

// Effect-aware structural equality: `expect(a).toEqual(b)` honors the Effect
// `Equal` trait (Option, Either, Exit, Data, schema classes, …); values that do
// not implement `Equal` fall through to vitest's default testers.
expect.addEqualityTesters([
  function (a: unknown, b: unknown): boolean | undefined {
    const aEq = Equal.isEqual(a)
    const bEq = Equal.isEqual(b)
    if (aEq && bEq) return Equal.equals(a, b)
    if (aEq !== bEq) return false
    return undefined
  },
])
