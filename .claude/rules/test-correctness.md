# Test Correctness

Coverage measures line execution, not semantic correctness. These rules close the gap.

## Cross-API Consistency

When a module exports multiple public functions that operate on the same domain, add a property test or explicit test that verifies they **agree**:

- If `score(n, h)` returns Some, then `match([{text: h}], n)` must return results and `positions(n, h)` must return Some.
- If `hasMatch(n, h)` returns false and no alternative matching path exists, then `score(n, h)` must return None.
- When two functions share a concept (e.g. "this is a match"), test that they define it identically.

Pattern:
```typescript
Test.property('APIs agree', arbNeedle, arbHaystack, (needle, haystack) => {
  const s = Mod.score(needle, haystack)
  const m = Mod.match([{ text: haystack }], needle)
  const p = Mod.positions(needle, haystack)
  if (Option.isSome(s)) {
    expect(m.length).toBeGreaterThan(0)
    expect(Option.isSome(p)).toBe(true)
  }
})
```

## Never Narrow a Failing Test

When a property test or assertion fails:

1. **Investigate the counterexample** — reproduce it, trace the data flow
2. **Fix the code** if the test exposed a real inconsistency
3. **Fix the test** only if the invariant was genuinely wrong (document why)
4. **Never** add `if (!condition) skip` guards to exclude failing inputs without first proving the exclusion is semantically correct

Narrowing a test to make it pass is hiding a bug, not fixing one.

## Performance Gate Determinism

- **Local**: gate on `mean` (robust to OS jitter). **CI**: gate on `p99` (controlled environment).
- Never gate on p99 locally — a single GC pause or context switch dominates 500ms-window p99.
- Set local mean budgets at 3-5x observed mean to absorb thermal throttle under sustained load.
- Always report both mean and p99 in diagnostic output regardless of which is gated.

## Property Tests for Invariants

Use property-based tests (`fast-check` via `Test.property`) to verify relationships between functions — not just individual function behavior:

- **Consistency**: multiple APIs agree on the same concept
- **Roundtrip**: `decode(encode(x)) === x`
- **Monotonicity**: if input grows, output doesn't shrink (when expected)
- **Idempotency**: `f(f(x)) === f(x)` (when expected)

Property tests find edge cases that hand-written tests miss (empty strings, single characters, spaces, unicode, boundary values).
