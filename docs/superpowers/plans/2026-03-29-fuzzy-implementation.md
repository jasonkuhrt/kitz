# @kitz/fuzzy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `@kitz/fuzzy` — fuzzy string matching with fzy's two-matrix DP core, fzf's character-class scoring, and an order-independent assignment fallback that eliminates the zero-results cliff.

**Architecture:** Two scoring paths (subsequence DP + greedy-with-repair assignment) share character-class infrastructure. Both produce matched positions that feed into a booster evaluation pipeline. The match gate is multiset containment, not subsequence order. `match()` auto-tunes booster weights based on candidate count.

**Tech Stack:** TypeScript, Effect (`Option`, `pipe`, `Order`), Vitest, native arrays in the scoring hot loop.

**Spec:** `packages/fuzzy/README.md` (user-facing), `packages/fuzzy/CONTRIBUTING.md` (internals + boundary bonus table)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/constants.ts` | Scoring constants (ScoreMatch, ScoreGapStart, etc.) and CharClass enum |
| `src/character-class.ts` | `charClassOf(charCode)` classification + `boundaryBonus(prevClass, currClass)` lookup |
| `src/has-match.ts` | `hasMatch(needle, haystack)` — multiset containment check |
| `src/score.ts` | `score(needle, haystack)` — orchestrator: tries subsequence path, falls back to assignment path |
| `src/subsequence.ts` | Two-matrix DP: `subsequenceScore(needle, haystack, classes, bonuses)` returning `{ score, positions }` or null |
| `src/assignment.ts` | Greedy-with-repair: `assignmentScore(needle, haystack, classes, bonuses)` returning `{ score, positions }` |
| `src/positions.ts` | `positions(needle, haystack)` — delegates to score internals, returns only positions |
| `src/match.ts` | `match(candidates, query)` — batch filter + score + sort with candidate-count heuristic and consumer boost |
| `src/__.ts` | Barrel: re-exports public API |
| `src/_.ts` | Namespace: `export * as Fuzzy` |

Tests are colocated: `src/has-match.test.ts`, `src/score.test.ts`, etc.

---

### Task 1: Constants and CharClass Enum

**Files:**
- Create: `packages/fuzzy/src/constants.ts`
- Test: `packages/fuzzy/src/constants.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/fuzzy/src/constants.test.ts
import { describe, expect, test } from 'vitest'
import {
  BonusBoundary,
  BonusBoundaryDelimiter,
  BonusBoundaryWhite,
  BonusCamel123,
  BonusConsecutive,
  BonusFirstCharMultiplier,
  BonusNonWord,
  CaseMatchBonus,
  CharClass,
  ScoreGapExtension,
  ScoreGapStart,
  ScoreMatch,
} from './constants.js'

describe('scoring constants', () => {
  test('match fzf values', () => {
    expect(ScoreMatch).toBe(16)
    expect(ScoreGapStart).toBe(-3)
    expect(ScoreGapExtension).toBe(-1)
    expect(BonusBoundaryWhite).toBe(10)
    expect(BonusBoundaryDelimiter).toBe(9)
    expect(BonusBoundary).toBe(8)
    expect(BonusNonWord).toBe(8)
    expect(BonusCamel123).toBe(7)
    expect(BonusConsecutive).toBe(4)
    expect(BonusFirstCharMultiplier).toBe(2)
    expect(CaseMatchBonus).toBe(1)
  })
})

describe('CharClass enum', () => {
  test('has all seven classes', () => {
    expect(CharClass.White).toBe(0)
    expect(CharClass.NonWord).toBe(1)
    expect(CharClass.Delimiter).toBe(2)
    expect(CharClass.Lower).toBe(3)
    expect(CharClass.Upper).toBe(4)
    expect(CharClass.Letter).toBe(5)
    expect(CharClass.Number).toBe(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/fuzzy vitest run src/constants.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement constants.ts**

```typescript
// packages/fuzzy/src/constants.ts

export const ScoreMatch = 16
export const ScoreGapStart = -3
export const ScoreGapExtension = -1
export const BonusBoundaryWhite = 10
export const BonusBoundaryDelimiter = 9
export const BonusBoundary = 8
export const BonusNonWord = 8
export const BonusCamel123 = 7
export const BonusConsecutive = 4
export const BonusFirstCharMultiplier = 2
export const CaseMatchBonus = 1

export const CharClass = {
  White: 0,
  NonWord: 1,
  Delimiter: 2,
  Lower: 3,
  Upper: 4,
  Letter: 5,
  Number: 6,
} as const

export type CharClass = (typeof CharClass)[keyof typeof CharClass]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/fuzzy vitest run src/constants.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/fuzzy/src/constants.ts packages/fuzzy/src/constants.test.ts
git commit -m "feat(fuzzy): add scoring constants and CharClass enum from fzf"
```

---

### Task 2: Character Classification and Boundary Bonus Lookup

**Files:**
- Create: `packages/fuzzy/src/character-class.ts`
- Test: `packages/fuzzy/src/character-class.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/fuzzy/src/character-class.test.ts
import { describe, expect, test } from 'vitest'
import {
  BonusBoundaryDelimiter,
  BonusBoundaryWhite,
  BonusCamel123,
  BonusNonWord,
  CharClass,
} from './constants.js'
import { boundaryBonus, charClassOf } from './character-class.js'

describe('charClassOf', () => {
  test('whitespace', () => {
    expect(charClassOf(' '.charCodeAt(0))).toBe(CharClass.White)
    expect(charClassOf('\t'.charCodeAt(0))).toBe(CharClass.White)
    expect(charClassOf('\n'.charCodeAt(0))).toBe(CharClass.White)
  })

  test('delimiters', () => {
    expect(charClassOf('-'.charCodeAt(0))).toBe(CharClass.Delimiter)
    expect(charClassOf('_'.charCodeAt(0))).toBe(CharClass.Delimiter)
    expect(charClassOf('/'.charCodeAt(0))).toBe(CharClass.Delimiter)
  })

  test('lowercase', () => {
    expect(charClassOf('a'.charCodeAt(0))).toBe(CharClass.Lower)
    expect(charClassOf('z'.charCodeAt(0))).toBe(CharClass.Lower)
  })

  test('uppercase', () => {
    expect(charClassOf('A'.charCodeAt(0))).toBe(CharClass.Upper)
    expect(charClassOf('Z'.charCodeAt(0))).toBe(CharClass.Upper)
  })

  test('numbers', () => {
    expect(charClassOf('0'.charCodeAt(0))).toBe(CharClass.Number)
    expect(charClassOf('9'.charCodeAt(0))).toBe(CharClass.Number)
  })

  test('nonword punctuation', () => {
    expect(charClassOf('.'.charCodeAt(0))).toBe(CharClass.NonWord)
    expect(charClassOf(','.charCodeAt(0))).toBe(CharClass.NonWord)
    expect(charClassOf(':'.charCodeAt(0))).toBe(CharClass.NonWord)
    expect(charClassOf('!'.charCodeAt(0))).toBe(CharClass.NonWord)
  })
})

describe('boundaryBonus', () => {
  test('whitespace to lower = BonusBoundaryWhite', () => {
    expect(boundaryBonus(CharClass.White, CharClass.Lower)).toBe(BonusBoundaryWhite)
  })

  test('delimiter to lower = BonusBoundaryDelimiter', () => {
    expect(boundaryBonus(CharClass.Delimiter, CharClass.Lower)).toBe(BonusBoundaryDelimiter)
  })

  test('lower to upper = BonusCamel123 (camelCase)', () => {
    expect(boundaryBonus(CharClass.Lower, CharClass.Upper)).toBe(BonusCamel123)
  })

  test('lower to number = BonusCamel123', () => {
    expect(boundaryBonus(CharClass.Lower, CharClass.Number)).toBe(BonusCamel123)
  })

  test('nonword to lower = BonusNonWord', () => {
    expect(boundaryBonus(CharClass.NonWord, CharClass.Lower)).toBe(BonusNonWord)
  })

  test('lower to lower = 0 (no transition)', () => {
    expect(boundaryBonus(CharClass.Lower, CharClass.Lower)).toBe(0)
  })

  test('upper to upper = 0', () => {
    expect(boundaryBonus(CharClass.Upper, CharClass.Upper)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/fuzzy vitest run src/character-class.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement character-class.ts**

Implement `charClassOf(charCode: number): CharClass` and `boundaryBonus(prevClass: CharClass, currClass: CharClass): number` following the 7×7 transition table in `CONTRIBUTING.md`.

The `charClassOf` function classifies ASCII characters:
- space/tab/newline → White
- `-`, `_`, `/` → Delimiter
- `a`–`z` → Lower
- `A`–`Z` → Upper
- `0`–`9` → Number
- Non-ASCII letters → Letter
- Everything else → NonWord

The `boundaryBonus` function implements the transition table from CONTRIBUTING.md. Use a flat 2D array `bonusTable[prevClass][currClass]` pre-computed at module load for O(1) lookup.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/fuzzy vitest run src/character-class.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/fuzzy/src/character-class.ts packages/fuzzy/src/character-class.test.ts
git commit -m "feat(fuzzy): add character classification and boundary bonus lookup"
```

---

### Task 3: hasMatch — Multiset Containment

**Files:**
- Create: `packages/fuzzy/src/has-match.ts`
- Test: `packages/fuzzy/src/has-match.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/fuzzy/src/has-match.test.ts
import { describe, expect, test } from 'vitest'
import { hasMatch } from './has-match.js'

describe('hasMatch', () => {
  test('empty needle matches anything', () => {
    expect(hasMatch('', 'anything')).toBe(true)
    expect(hasMatch('', '')).toBe(true)
  })

  test('non-empty needle against empty haystack fails', () => {
    expect(hasMatch('x', '')).toBe(false)
  })

  test('subsequence match passes', () => {
    expect(hasMatch('cfg', 'Config')).toBe(true)
  })

  test('out-of-order characters pass (multiset containment)', () => {
    expect(hasMatch('vdi', 'david')).toBe(true)
  })

  test('missing character fails', () => {
    expect(hasMatch('cxg', 'Config')).toBe(false)
  })

  test('multiplicity is respected', () => {
    expect(hasMatch('ll', 'reload')).toBe(false)
    expect(hasMatch('ll', 'llama')).toBe(true)
  })

  test('case insensitive', () => {
    expect(hasMatch('CFG', 'config')).toBe(true)
    expect(hasMatch('cfg', 'CONFIG')).toBe(true)
  })

  test('needle longer than haystack fails', () => {
    expect(hasMatch('abcdef', 'abc')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/fuzzy vitest run src/has-match.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement has-match.ts**

Count character frequencies in both needle and haystack (case-folded to lowercase). For each needle character, check that the haystack has at least as many occurrences. O(n + m) time, no allocations beyond a small frequency array (use a 128-element array for ASCII, Map fallback for non-ASCII).

```typescript
// packages/fuzzy/src/has-match.ts

/**
 * Multiset containment check. Returns true when every character in the needle
 * exists in the haystack with at least the same multiplicity (case-insensitive).
 * O(n + m) time, no scoring overhead.
 */
export const hasMatch = (needle: string, haystack: string): boolean => {
  if (needle.length === 0) return true
  if (needle.length > haystack.length) return false

  // Count character frequencies in haystack (case-folded)
  const counts = new Map<number, number>()
  for (let i = 0; i < haystack.length; i++) {
    const ch = toLower(haystack.charCodeAt(i))
    counts.set(ch, (counts.get(ch) ?? 0) + 1)
  }

  // Check each needle character has sufficient count
  for (let i = 0; i < needle.length; i++) {
    const ch = toLower(needle.charCodeAt(i))
    const remaining = counts.get(ch) ?? 0
    if (remaining <= 0) return false
    counts.set(ch, remaining - 1)
  }

  return true
}

const toLower = (charCode: number): number =>
  charCode >= 65 && charCode <= 90 ? charCode + 32 : charCode
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/fuzzy vitest run src/has-match.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/fuzzy/src/has-match.ts packages/fuzzy/src/has-match.test.ts
git commit -m "feat(fuzzy): add hasMatch multiset containment check"
```

---

### Task 4: Subsequence Path — Two-Matrix DP Scorer

**Files:**
- Create: `packages/fuzzy/src/subsequence.ts`
- Test: `packages/fuzzy/src/subsequence.test.ts`

This is the core DP algorithm. The test vectors for `cfg`/`Config` = 63 and `cr`/`configReload` = 53 are normative.

- [ ] **Step 1: Write the test**

```typescript
// packages/fuzzy/src/subsequence.test.ts
import { describe, expect, test } from 'vitest'
import { subsequenceScore } from './subsequence.js'

describe('subsequenceScore', () => {
  test('returns null when needle is not a subsequence', () => {
    expect(subsequenceScore('vdi', 'david')).toBeNull()
    expect(subsequenceScore('cxg', 'Config')).toBeNull()
  })

  test('cfg / Config = 63 (normative)', () => {
    const result = subsequenceScore('cfg', 'Config')
    expect(result).not.toBeNull()
    expect(result!.score).toBe(63)
    expect(result!.positions).toEqual([0, 3, 5])
  })

  test('cr / configReload = 53 (normative)', () => {
    const result = subsequenceScore('cr', 'configReload')
    expect(result).not.toBeNull()
    expect(result!.score).toBe(53)
    expect(result!.positions).toEqual([0, 6])
  })

  test('empty needle returns score 0, empty positions', () => {
    const result = subsequenceScore('', 'anything')
    expect(result).not.toBeNull()
    expect(result!.score).toBe(0)
    expect(result!.positions).toEqual([])
  })

  test('exact match abc/abc', () => {
    const result = subsequenceScore('abc', 'abc')
    expect(result).not.toBeNull()
    expect(result!.positions).toEqual([0, 1, 2])
  })

  test('case insensitive: abc/ABC', () => {
    const result = subsequenceScore('abc', 'ABC')
    expect(result).not.toBeNull()
    expect(result!.positions).toEqual([0, 1, 2])
  })

  test('case match bonus: CFG scores higher than cfg on Config', () => {
    // Not normative exact score, but C matches C exactly while c doesn't
    const upper = subsequenceScore('Cfg', 'Config')
    const lower = subsequenceScore('cfg', 'Config')
    expect(upper).not.toBeNull()
    expect(lower).not.toBeNull()
    // 'C' exactly matches 'C' → +1 CaseMatchBonus. 'c' matches 'C' → no bonus
    expect(upper!.score).toBeGreaterThan(lower!.score)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/fuzzy vitest run src/subsequence.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement subsequence.ts**

Implement the two-matrix DP from CONTRIBUTING.md:
1. First pass: check if needle is a subsequence of haystack (linear scan). Return null if not.
2. Classify all haystack characters into CharClass array.
3. Compute boundary bonus for each haystack position.
4. Fill M and D matrices using the recurrence from CONTRIBUTING.md.
5. Traceback through D to recover positions (prefer leftmost optimal).
6. Return `{ score: M[n][m], positions }` where n = needle length, m = haystack length.

The function signature:

```typescript
export const subsequenceScore = (
  needle: string,
  haystack: string,
): { score: number; positions: number[] } | null
```

Follow the literate code convention: inline comments explain each step of the DP from first principles. Reference the recurrence from CONTRIBUTING.md.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/fuzzy vitest run src/subsequence.test.ts`
Expected: PASS — especially the normative 63 and 53 scores

- [ ] **Step 5: Commit**

```bash
git add packages/fuzzy/src/subsequence.ts packages/fuzzy/src/subsequence.test.ts
git commit -m "feat(fuzzy): implement two-matrix DP subsequence scorer"
```

---

### Task 5: Assignment Path — Greedy with Repair

**Files:**
- Create: `packages/fuzzy/src/assignment.ts`
- Test: `packages/fuzzy/src/assignment.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/fuzzy/src/assignment.test.ts
import { describe, expect, test } from 'vitest'
import { assignmentScore } from './assignment.js'

describe('assignmentScore', () => {
  test('vdi / david returns a score and positions', () => {
    const result = assignmentScore('vdi', 'david')
    expect(result).not.toBeNull()
    expect(result!.score).toBeGreaterThan(0)
    // All three needle chars should be assigned
    expect(result!.positions).toHaveLength(3)
  })

  test('returns null when multiset containment fails', () => {
    expect(assignmentScore('cxg', 'Config')).toBeNull()
    expect(assignmentScore('ll', 'reload')).toBeNull()
  })

  test('vdi / david scores higher than vdi / provide (shorter + denser)', () => {
    const david = assignmentScore('vdi', 'david')
    const provide = assignmentScore('vdi', 'provide')
    expect(david).not.toBeNull()
    expect(provide).not.toBeNull()
    expect(david!.score).toBeGreaterThan(provide!.score)
  })

  test('abc / acb scores higher than abc / cba (one transposition vs full reversal)', () => {
    const acb = assignmentScore('abc', 'acb')
    const cba = assignmentScore('abc', 'cba')
    expect(acb).not.toBeNull()
    expect(cba).not.toBeNull()
    expect(acb!.score).toBeGreaterThan(cba!.score)
  })

  test('prefers compact cluster over scattered boundary hits', () => {
    // 'bac' has a compact cluster at {0,1,2}
    // 'b-a-c' has delimiter boundaries but is scattered
    const compact = assignmentScore('cab', 'bac')
    const scattered = assignmentScore('cab', 'b-a-c')
    expect(compact).not.toBeNull()
    expect(scattered).not.toBeNull()
    // Compact cluster should win or be competitive
    expect(compact!.score).toBeGreaterThanOrEqual(scattered!.score)
  })

  test('empty needle returns score 0', () => {
    const result = assignmentScore('', 'anything')
    expect(result).not.toBeNull()
    expect(result!.score).toBe(0)
    expect(result!.positions).toEqual([])
  })

  test('respects character multiplicity', () => {
    // 'tt' needs two t's — 'toggle_sidebar' has two
    const result = assignmentScore('tt', 'toggle_sidebar')
    // t at 0, t at ... depends on where second t is
    // toggle_sidebar: t(0), o(1), g(2), g(3), l(4), e(5), _(6), s(7), i(8), d(9), e(10), b(11), a(12), r(13)
    // Only one 't' at position 0. So this should be null.
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/fuzzy vitest run src/assignment.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement assignment.ts**

Implement the greedy-with-repair algorithm from CONTRIBUTING.md:

1. Check multiset containment (reuse `hasMatch` logic or character counting). Return null if fails.
2. Classify haystack characters, compute boundary bonuses.
3. **Greedy seed**: For each needle character, find all matching positions in haystack. Assign to the available position with the highest boundary bonus. Mark used.
4. **Repair pass**: For each needle character that has alternative positions, try swapping. Evaluate full score (edge hits + coverage + compactness + gap penalty + order coherence) on each candidate swap. Accept if global score improves.
5. Compute final score from the assigned positions using:
   - Sum of `ScoreMatch + boundaryBonus` per position
   - Coverage ratio: `needle.length / haystack.length` scaled
   - Window compactness: penalty for spread
   - Gap penalty between sorted positions
   - Order-coherence gradient: LIS length of positions in needle order
6. Return `{ score, positions }` in needle order.

```typescript
export const assignmentScore = (
  needle: string,
  haystack: string,
): { score: number; positions: number[] } | null
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/fuzzy vitest run src/assignment.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/fuzzy/src/assignment.ts packages/fuzzy/src/assignment.test.ts
git commit -m "feat(fuzzy): implement greedy-with-repair assignment scorer"
```

---

### Task 6: score() — Orchestrator

**Files:**
- Create: `packages/fuzzy/src/score.ts`
- Test: `packages/fuzzy/src/score.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/fuzzy/src/score.test.ts
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { score } from './score.js'

describe('score', () => {
  test('subsequence match: cfg / Config = Some(63)', () => {
    const result = score('cfg', 'Config')
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe(63)
  })

  test('subsequence match: cr / configReload = Some(53)', () => {
    const result = score('cr', 'configReload')
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe(53)
  })

  test('out-of-order match: vdi / david = Some(<positive>)', () => {
    const result = score('vdi', 'david')
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBeGreaterThan(0)
  })

  test('no match: cxg / Config = None', () => {
    expect(Option.isNone(score('cxg', 'Config'))).toBe(true)
  })

  test('no match: ll / reload = None', () => {
    expect(Option.isNone(score('ll', 'reload'))).toBe(true)
  })

  test('empty needle = Some(0)', () => {
    const result = score('', 'anything')
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe(0)
  })

  test('empty haystack = None', () => {
    expect(Option.isNone(score('x', ''))).toBe(true)
  })

  test('subsequence scores higher than out-of-order for similar strings', () => {
    // 'ab' is a subsequence of 'ab' but not of 'ba'
    const subseq = score('ab', 'ab')
    const ooo = score('ab', 'ba')
    expect(Option.isSome(subseq)).toBe(true)
    expect(Option.isSome(ooo)).toBe(true)
    expect(Option.getOrThrow(subseq)).toBeGreaterThan(Option.getOrThrow(ooo))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/fuzzy vitest run src/score.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement score.ts**

The orchestrator:
1. If needle is empty, return `Option.some(0)`.
2. If haystack is empty or multiset containment fails, return `Option.none()`.
3. Try `subsequenceScore(needle, haystack)`. If it returns a result, return `Option.some(result.score)`.
4. Try `assignmentScore(needle, haystack)`. If it returns a result, return `Option.some(result.score)`.
5. Return `Option.none()` (shouldn't happen if hasMatch passed, but safety).

```typescript
// packages/fuzzy/src/score.ts
import { Option } from 'effect'
import { assignmentScore } from './assignment.js'
import { hasMatch } from './has-match.js'
import { subsequenceScore } from './subsequence.js'

export const score: {
  (needle: string, haystack: string): Option.Option<number>
  (needle: string): (haystack: string) => Option.Option<number>
} = (...args: [string, string?]) => {
  if (args.length === 1) {
    const needle = args[0]
    return (haystack: string) => scoreImpl(needle, haystack)
  }
  return scoreImpl(args[0], args[1]!)
}

const scoreImpl = (needle: string, haystack: string): Option.Option<number> => {
  if (needle.length === 0) return Option.some(0)
  if (!hasMatch(needle, haystack)) return Option.none()

  const subseq = subsequenceScore(needle, haystack)
  if (subseq !== null) return Option.some(subseq.score)

  const assignment = assignmentScore(needle, haystack)
  if (assignment !== null) return Option.some(assignment.score)

  return Option.none()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/fuzzy vitest run src/score.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/fuzzy/src/score.ts packages/fuzzy/src/score.test.ts
git commit -m "feat(fuzzy): add score() orchestrator with subsequence + assignment paths"
```

---

### Task 7: positions()

**Files:**
- Create: `packages/fuzzy/src/positions.ts`
- Test: `packages/fuzzy/src/positions.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/fuzzy/src/positions.test.ts
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { positions } from './positions.js'

describe('positions', () => {
  test('cfg / Config = Some([0, 3, 5])', () => {
    const result = positions('cfg', 'Config')
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toEqual([0, 3, 5])
  })

  test('cr / configReload = Some([0, 6])', () => {
    const result = positions('cr', 'configReload')
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toEqual([0, 6])
  })

  test('vdi / david returns positions in needle order', () => {
    const result = positions('vdi', 'david')
    expect(Option.isSome(result)).toBe(true)
    const pos = Option.getOrThrow(result)
    expect(pos).toHaveLength(3)
    // positions[0] = where 'v' matched, positions[1] = where 'd' matched, etc.
  })

  test('no match returns None', () => {
    expect(Option.isNone(positions('cxg', 'Config'))).toBe(true)
  })

  test('empty needle returns Some([])', () => {
    const result = positions('', 'anything')
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/fuzzy vitest run src/positions.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement positions.ts**

Same orchestration as `score()` but returns positions instead of score. Delegates to `subsequenceScore` or `assignmentScore` and extracts the positions array.

Provide data-first and data-last (curried) overloads.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/fuzzy vitest run src/positions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/fuzzy/src/positions.ts packages/fuzzy/src/positions.test.ts
git commit -m "feat(fuzzy): add positions() for UI highlighting"
```

---

### Task 8: match() — Batch Scoring with Candidate-Count Heuristic

**Files:**
- Create: `packages/fuzzy/src/match.ts`
- Test: `packages/fuzzy/src/match.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/fuzzy/src/match.test.ts
import { describe, expect, test } from 'vitest'
import { match } from './match.js'

describe('match', () => {
  test('filters out non-matches', () => {
    const results = match(
      [{ text: 'Config' }, { text: 'Close' }, { text: 'xyz' }],
      'cfg',
    )
    // 'xyz' has no c, f, or g → excluded
    const texts = results.map(r => r.candidate.text)
    expect(texts).not.toContain('xyz')
  })

  test('sorts by score descending', () => {
    const results = match(
      [{ text: 'Config' }, { text: 'configurable' }],
      'cfg',
    )
    expect(results.length).toBeGreaterThanOrEqual(1)
    // Config should score higher (shorter, denser)
    expect(results[0]!.candidate.text).toBe('Config')
  })

  test('empty query returns all candidates with score 0', () => {
    const results = match(
      [{ text: 'a' }, { text: 'b' }],
      '',
    )
    expect(results).toHaveLength(2)
    expect(results.every(r => r.score === 0)).toBe(true)
  })

  test('preserves extra candidate fields', () => {
    const results = match(
      [{ text: 'Config', id: 'cmd-1' }],
      'cfg',
    )
    expect(results[0]!.candidate.id).toBe('cmd-1')
  })

  test('consumer boost is folded into score', () => {
    const results = match(
      [
        { text: 'Config reload', boost: 0 },
        { text: 'Config export', boost: 50 },
      ],
      'cfg',
    )
    // Both match 'cfg'. 'Config export' has a large boost → should rank first
    expect(results[0]!.candidate.text).toBe('Config export')
  })

  test('includes out-of-order matches', () => {
    const results = match(
      [{ text: 'david' }, { text: 'xyz' }],
      'vdi',
    )
    expect(results.map(r => r.candidate.text)).toContain('david')
    expect(results.map(r => r.candidate.text)).not.toContain('xyz')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/fuzzy vitest run src/match.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement match.ts**

```typescript
// packages/fuzzy/src/match.ts
import { hasMatch } from './has-match.js'
import { subsequenceScore } from './subsequence.js'
import { assignmentScore } from './assignment.js'

export const match = <T extends { readonly text: string; readonly boost?: number }>(
  candidates: readonly T[],
  query: string,
): ReadonlyArray<{ candidate: T; score: number }> => {
  if (query.length === 0) {
    return candidates.map(candidate => ({ candidate, score: candidate.boost ?? 0 }))
  }

  const results: Array<{ candidate: T; score: number }> = []

  for (const candidate of candidates) {
    if (!hasMatch(query, candidate.text)) continue

    let matchScore = 0
    const subseq = subsequenceScore(query, candidate.text)
    if (subseq !== null) {
      matchScore = subseq.score
    } else {
      const assignment = assignmentScore(query, candidate.text)
      if (assignment !== null) {
        matchScore = assignment.score
      } else {
        continue
      }
    }

    const boost = candidate.boost ?? 0
    results.push({ candidate, score: matchScore + boost })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}
```

The candidate-count heuristic (modulating booster weights based on `candidates.length`) can be wired in after the core scoring works. Start with default weights, then add tuning.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/fuzzy vitest run src/match.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/fuzzy/src/match.ts packages/fuzzy/src/match.test.ts
git commit -m "feat(fuzzy): add match() batch scoring with consumer boost"
```

---

### Task 9: Wire Up Public API (Barrel + Namespace)

**Files:**
- Modify: `packages/fuzzy/src/__.ts`
- Modify: `packages/fuzzy/src/_.ts`
- Test: `packages/fuzzy/src/api.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/fuzzy/src/api.test.ts
import { Option, pipe } from 'effect'
import { describe, expect, test } from 'vitest'
import { Fuzzy } from './_.js'

describe('Fuzzy namespace API', () => {
  test('hasMatch is accessible', () => {
    expect(Fuzzy.hasMatch('cfg', 'Config')).toBe(true)
  })

  test('score is accessible and returns Option', () => {
    const result = Fuzzy.score('cfg', 'Config')
    expect(Option.isSome(result)).toBe(true)
  })

  test('score data-last curried form works with pipe', () => {
    const result = pipe('Config', Fuzzy.score('cfg'))
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe(63)
  })

  test('positions is accessible', () => {
    const result = Fuzzy.positions('cfg', 'Config')
    expect(Option.isSome(result)).toBe(true)
  })

  test('match is accessible', () => {
    const results = Fuzzy.match([{ text: 'Config' }], 'cfg')
    expect(results).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd packages/fuzzy vitest run src/api.test.ts`
Expected: FAIL — barrel doesn't export anything yet

- [ ] **Step 3: Update barrel and namespace**

```typescript
// packages/fuzzy/src/__.ts
export { hasMatch } from './has-match.js'
export { match } from './match.js'
export { positions } from './positions.js'
export { score } from './score.js'

// Re-export constants and CharClass for consumers building custom scorers
export {
  BonusBoundary,
  BonusBoundaryDelimiter,
  BonusBoundaryWhite,
  BonusCamel123,
  BonusConsecutive,
  BonusFirstCharMultiplier,
  BonusNonWord,
  CaseMatchBonus,
  CharClass,
  ScoreGapExtension,
  ScoreGapStart,
  ScoreMatch,
} from './constants.js'
```

The `_.ts` namespace file already has `export * as Fuzzy from './__.js'` — no change needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run --cwd packages/fuzzy vitest run src/api.test.ts`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `bun run --cwd packages/fuzzy vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/fuzzy/src/__.ts packages/fuzzy/src/api.test.ts
git commit -m "feat(fuzzy): wire up public API barrel and namespace exports"
```

---

### Task 10: Integration Tests — Golden Test Vectors

**Files:**
- Create: `packages/fuzzy/src/golden-vectors.test.ts`

- [ ] **Step 1: Write comprehensive golden vector tests**

```typescript
// packages/fuzzy/src/golden-vectors.test.ts
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Fuzzy } from './_.js'

describe('Golden Test Vectors — Subsequence Path', () => {
  test('cfg / Config', () => {
    expect(Fuzzy.hasMatch('cfg', 'Config')).toBe(true)
    expect(Option.getOrThrow(Fuzzy.score('cfg', 'Config'))).toBe(63)
    expect(Option.getOrThrow(Fuzzy.positions('cfg', 'Config'))).toEqual([0, 3, 5])
  })

  test('cxg / Config — no match', () => {
    expect(Fuzzy.hasMatch('cxg', 'Config')).toBe(false)
    expect(Option.isNone(Fuzzy.score('cxg', 'Config'))).toBe(true)
    expect(Option.isNone(Fuzzy.positions('cxg', 'Config'))).toBe(true)
  })

  test('cr / configReload', () => {
    expect(Fuzzy.hasMatch('cr', 'configReload')).toBe(true)
    expect(Option.getOrThrow(Fuzzy.score('cr', 'configReload'))).toBe(53)
    expect(Option.getOrThrow(Fuzzy.positions('cr', 'configReload'))).toEqual([0, 6])
  })

  test('empty needle / anything', () => {
    expect(Fuzzy.hasMatch('', 'anything')).toBe(true)
    expect(Option.getOrThrow(Fuzzy.score('', 'anything'))).toBe(0)
    expect(Option.getOrThrow(Fuzzy.positions('', 'anything'))).toEqual([])
  })

  test('x / empty haystack', () => {
    expect(Fuzzy.hasMatch('x', '')).toBe(false)
    expect(Option.isNone(Fuzzy.score('x', ''))).toBe(true)
    expect(Option.isNone(Fuzzy.positions('x', ''))).toBe(true)
  })
})

describe('Golden Test Vectors — Assignment Path', () => {
  test('vdi / david — out-of-order match exists', () => {
    expect(Fuzzy.hasMatch('vdi', 'david')).toBe(true)
    const s = Fuzzy.score('vdi', 'david')
    expect(Option.isSome(s)).toBe(true)
    expect(Option.getOrThrow(s)).toBeGreaterThan(0)
  })

  test('ll / reload — multiplicity fails', () => {
    expect(Fuzzy.hasMatch('ll', 'reload')).toBe(false)
    expect(Option.isNone(Fuzzy.score('ll', 'reload'))).toBe(true)
  })

  test('abc / cba — full reversal, low score', () => {
    const s = Fuzzy.score('abc', 'cba')
    expect(Option.isSome(s)).toBe(true)
    expect(Option.getOrThrow(s)).toBeGreaterThan(0)
  })

  test('abc / acb — one transposition, higher than full reversal', () => {
    const acb = Option.getOrThrow(Fuzzy.score('abc', 'acb'))
    const cba = Option.getOrThrow(Fuzzy.score('abc', 'cba'))
    expect(acb).toBeGreaterThan(cba)
  })
})

describe('Score ordering invariants', () => {
  test('subsequence match > out-of-order match for similar candidates', () => {
    // 'ab' is subsequence of 'ab', not subsequence of 'ba'
    const subseq = Option.getOrThrow(Fuzzy.score('ab', 'ab'))
    const ooo = Option.getOrThrow(Fuzzy.score('ab', 'ba'))
    expect(subseq).toBeGreaterThan(ooo)
  })

  test('shorter candidate with same chars scores higher (coverage ratio)', () => {
    const short = Option.getOrThrow(Fuzzy.score('vdi', 'david'))
    const long = Option.getOrThrow(Fuzzy.score('vdi', 'individual'))
    expect(short).toBeGreaterThan(long)
  })
})

describe('match() integration', () => {
  test('sorts by score, excludes non-matches, preserves extra fields', () => {
    const results = Fuzzy.match(
      [
        { text: 'Config', id: 1 },
        { text: 'configurable', id: 2 },
        { text: 'xyz', id: 3 },
      ],
      'cfg',
    )
    expect(results.map(r => r.candidate.id)).not.toContain(3)
    expect(results[0]!.candidate.text).toBe('Config')
  })

  test('consumer boost shifts ranking', () => {
    const results = Fuzzy.match(
      [
        { text: 'Config', boost: 0 },
        { text: 'configurable', boost: 100 },
      ],
      'cfg',
    )
    expect(results[0]!.candidate.text).toBe('configurable')
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `bun run --cwd packages/fuzzy vitest run`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add packages/fuzzy/src/golden-vectors.test.ts
git commit -m "test(fuzzy): add golden test vectors for both scoring paths"
```

---

### Task 11: Type Check + Lint + Build

- [ ] **Step 1: Type check**

Run: `bun run --cwd packages/fuzzy check:types`
Expected: No errors

- [ ] **Step 2: Lint**

Run: `bun run --cwd packages/fuzzy check:lint`
Expected: No warnings (treat oxlint warnings as blocking per CLAUDE.md)

- [ ] **Step 3: Build**

Run: `bun run --cwd packages/fuzzy build`
Expected: Clean build with no errors

- [ ] **Step 4: Run pre-commit hook**

Run: `bun run pre-commit`
Expected: PASS

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A packages/fuzzy/
git commit -m "chore(fuzzy): fix lint/type issues from initial implementation"
```
