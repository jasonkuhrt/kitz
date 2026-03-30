# Contributing to @kitz/fuzzy

## Getting Started

Clone the repo (or `git worktree add`). The `prepare` script configures hooks automatically after install.

## Literate Code

This package takes a literate approach to implementation. The algorithm originates in bioinformatics (Needleman-Wunsch, Smith-Waterman, Gotoh) and was adapted to text matching by fzy and fzf. The author does not have a CS background, so the source code maintains ground-up explanations of every algorithmic concept as inline comments — written as if working through a CS course on sequence alignment and scoring.

The explanations are not afterthoughts or optional documentation. They are load-bearing: maintained alongside the code, reviewed in PRs, and treated as first-class artifacts. If an explanation drifts from the implementation, that is a bug.

**When modifying algorithm code:**

- Update the inline explanation before or alongside the code change, not after
- Explain *why* the math works, not just *what* the code does — a reader should be able to follow the reasoning from first principles without consulting external papers
- Use concrete examples with small matrices (3×4, not 10×20) to illustrate DP recurrences
- Name variables after their algorithmic role (`bestScoreEndingInMatch`, not `d`) — the full name is always correct, abbreviation is never a valid reason to shorten

**When adding new algorithmic concepts:**

- Introduce the concept before the code that uses it
- Build on previously explained concepts — if the explanation references the M matrix, the M matrix explanation must appear earlier in the source
- Include a "why this matters for fuzzy matching" bridge — the bioinformatics origins are interesting but the reader needs to understand why the adaptation works for text

This approach exists for fun and profit. The fun: learning and teaching sequence alignment through working code. The profit: contributors (including future-you) can modify the scoring algorithm with confidence because the reasoning is visible, not hidden in a paper or a commit message from 2026.

## Codebase Map

```
packages/fuzzy/
├── README.md              # User-facing spec (the README IS the design document)
├── CONTRIBUTING.md        # This file
├── docs/
│   ├── credits.md         # Lineage, studied implementations, academic foundations
│   └── rationales/        # Architecture decision records
└── src/
    ├── _.ts               # Namespace: export * as Fuzzy
    └── __.ts              # Barrel: public API exports
```

Implementation modules will be added under `src/` as the spec is implemented. Expected structure:

| Module | Purpose |
| --- | --- |
| `has-match.ts` | Multiset containment check (O(n+m), no allocations) |
| `score.ts` | Two-matrix DP scoring (subsequence path) |
| `assignment.ts` | Greedy-with-repair scoring (assignment path) |
| `positions.ts` | Traceback through D matrix (subsequence) or position set (assignment) |
| `match.ts` | Batch filter + score + sort with candidate-count heuristic |
| `character-class.ts` | Character → class classification, bonus lookup |
| `constants.ts` | Scoring constants (from fzf) and character class enum |
| `boosters.ts` | Booster evaluation on a set of matched positions |

## Boundaries

`@kitz/fuzzy` is a leaf package. It depends on `effect` (for `Option`, `pipe`, `Order`) and nothing else in the kitz workspace.

The dependency direction is strictly one-way: other packages import from `@kitz/fuzzy`, never the reverse. The primary consumer is `@kitz/cmx`, which wraps fuzzy matching behind a `Matcher` Effect service.

**Internal boundary:** The scoring hot loop (DP matrices, character class lookup, bonus computation, greedy assignment) uses native arrays and arithmetic. Effect types appear only at the API surface — function signatures return `Option`, functions are pipe-friendly. This is deliberate: `Option` is the right abstraction for "no match", but `HashMap` is the wrong abstraction for a 7×7 bonus table accessed thousands of times per keystroke.

**Path boundary:** The subsequence path and assignment path share character class infrastructure and booster evaluation but have independent alignment algorithms. The subsequence path uses the two-matrix DP. The assignment path uses greedy-with-repair. They produce the same type of output (a set of matched positions) and feed into the same booster evaluation pipeline.

## Subsequence Path: DP Algorithm

The DP core finds the optimal alignment between needle and haystack using two matrices: **M** (best overall score at each position) and **D** (best score ending in a match at each position). This guarantees the highest-scoring alignment is found — not just the first or greediest one.

**Base cases.** M[0][j] = 0 for all j (no needle characters matched yet). D[0][j] = −∞ (cannot end in a match with zero needle characters).

**Consecutive chunk rule.** When extending a run of consecutive matches, the bonus is `max(currentBonus, firstBonusInChunk, BonusConsecutive)`. A consecutive run starting at a strong boundary carries that initial bonus through the entire run.

**Boundary bonus table.** The bonus awarded at position j depends on the transition from `class(j-1)` to `class(j)`. The start of the string is treated as `White`. The first matched character's bonus is doubled (`BonusFirstCharMultiplier`).

| prev \ curr | White | NonWord | Delimiter | Lower | Upper | Letter | Number |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **White** | 0 | 0 | 0 | BonusBoundaryWhite | BonusBoundaryWhite | BonusBoundaryWhite | BonusBoundaryWhite |
| **NonWord** | 0 | 0 | 0 | BonusNonWord | BonusNonWord | BonusNonWord | BonusNonWord |
| **Delimiter** | 0 | 0 | 0 | BonusBoundaryDelimiter | BonusBoundaryDelimiter | BonusBoundaryDelimiter | BonusBoundaryDelimiter |
| **Lower** | 0 | 0 | 0 | 0 | BonusCamel123 | 0 | BonusCamel123 |
| **Upper** | 0 | 0 | 0 | 0 | 0 | 0 | BonusCamel123 |
| **Letter** | 0 | 0 | 0 | 0 | BonusBoundary | 0 | BonusBoundary |
| **Number** | 0 | 0 | 0 | BonusBoundary | BonusBoundary | BonusBoundary | 0 |

`BonusNonWord` (8) fires when the previous character is NonWord. `BonusBoundary` (8) is the generic fallback for transitions not covered by the stronger bonuses. `BonusCamel123` (7) covers lower→upper (camelCase) and non-number→number transitions.

**Recurrence:**

```
bonus(j) = boundaryBonus(class(j-1), class(j))

// When haystack[j] matches needle[i] (case-insensitive):
D[i][j] = max(
  M[i-1][j-1] + ScoreMatch + bonus(j),                                        // start new run
  D[i-1][j-1] + ScoreMatch + max(bonus(j), firstBonus, BonusConsecutive)       // extend run
)

// Always:
M[i][j] = max(
  D[i][j],                               // best ending in match here
  M[i][j-1] + gapPenalty(i, j)           // best with gap at j
)
```

The DP runs in O(n×m) time. Positions traceback prefers the leftmost optimal alignment.

## Assignment Path: Greedy with Repair

When the needle passes [`multiset containment`](README.md#multiset-containment) but fails the subsequence check:

**Greedy seed.** For each needle character (rarest first), find all matching haystack positions. Assign to the available position with the highest boundary bonus. Mark the position as used.

**Repair pass.** For each needle character with multiple candidate positions, try swapping the assigned position with each alternative. Accept the swap if the global score (all boosters evaluated on the full position set) improves. One pass.

The greedy seed optimizes local edge quality. The repair trades edge quality for global compactness when doing so improves the total score. This handles the greedy-versus-compact tension: greedy might chase a strong but distant boundary when a weaker but compact cluster scores better overall.

Runs in O(n × m) for the seed and O(k² × n) for the repair, where k is the average candidate positions per needle character.

## Score Normalization

The subsequence path includes a per-character base of `ScoreMatch` (16) that accumulates to `ScoreMatch × needleLen`. Before cross-path comparison in `match()`, this base is normalized so both paths compete on informative signal (boundary bonuses, structure, density) rather than branch-specific constants. A bounded order prior is added after normalization — roughly one boundary bonus worth — so that subsequence matches have a principled advantage without creating a hard lane boundary.

## Extension Points

The scoring constants and character class membership are fixed by design — they are part of the [behavioral contract](README.md#behavioral-contract). The package does not expose configuration knobs.

The booster weights are internally tunable via the candidate-count heuristic but not exposed to consumers. The candidate-count thresholds (≤15 relaxed, 15–80 balanced, 80+ strict) are implementation details that may be refined based on empirical testing.

The `boost` field on candidates is the extension point for consumer-provided signals. Consumers pre-compute external signals (proximity, recency, frequency) into a single number per candidate. Fuzzy folds it into the score additively. A future version may support pluggable consumer-defined boosters that participate in score normalization and candidate-count tuning, but v1 uses the simpler `boost: number` approach.

Consumers who need entirely different scoring behavior should wrap the package and post-process scores, or use the exported [`CharClass`](README.md#character-classes) and [`scoring constants`](README.md#scoring-constants-exported) to build a custom scorer.

## Key Decisions

| # | Decision | Why | Rejected | Rationale |
| --- | --- | --- | --- | --- |
| 1 | fzy's two-matrix DP over fzf's single-matrix V2 | Two matrices cleanly separate "best overall" from "best ending in match" — easier to reason about, same O(nm) cost | fzf's single-matrix approach | [0001](docs/rationales/0001-two-matrix-dp.md) |
| 2 | fzf's scoring constants over fzy's | Seven character classes and graduated bonuses produce better ranking for structured names | fzy's simpler float-valued bonuses | — |
| 3 | Fixed scoring, no configuration | Configuration creates ranking instability — users cannot reason about why results appear in a given order if the constants are tunable | Configurable bonus table | — |
| 4 | `Option` over sentinel values | `Option.none()` for "no match" is structurally distinct from `Option.some(0)` | Return 0 / empty array for no match | — |
| 5 | Literate code style | Author lacks CS background; inline explanations ensure the algorithm is understood, not cargo-culted | Standard code comments | — |
| 6 | Native arrays in hot loop | DP matrices are dense 2D numeric grids. `number[][]` is the fastest JS path | Effect data structures everywhere | — |
| 7 | Multiset containment over subsequence as match gate | Eliminates the zero-results cliff. Ordering becomes a booster, not a prerequisite. No mainstream matcher does this — the gap is confirmed by research. | Subsequence-only matching | [0007](docs/rationales/0007-multiset-containment-gate.md) |
| 8 | Booster-based scoring over lane/tier architecture | Additive boosters let order be one signal among many. Lanes re-introduce "subsequence or nothing" rigidity. Boosters self-adapt to haystack structure without mode switches. | Rigid precedence lanes, tiered fallback | [0008](docs/rationales/0008-booster-based-scoring.md) |
| 9 | Greedy-with-repair over Hungarian algorithm | Hungarian solves only additive objectives. The real score includes compactness and adjacency (pairwise interactions). Greedy+repair handles this at command-string scale. | Hungarian algorithm, brute-force permutation | [0009](docs/rationales/0009-greedy-with-repair.md) |
| 10 | Candidate-count heuristic in match() | Small sets need recall, large sets need precision. candidates.length is free information. No config surface needed. | Explicit mode/config parameter, fixed weights | — |

## Common Tasks

**Implement a function from the README spec:** Read the function's entry in [API Overview](README.md#api-overview), the [Behavioral Contract](README.md#behavioral-contract), and the [Golden Test Vectors](README.md#golden-test-vectors). Write tests against the vectors first. The README is the spec — if the implementation disagrees with the README, the implementation is wrong.

**Update a scoring constant:** Don't. The constants are from fzf's source and are part of the behavioral contract. If you genuinely need to change one, update the README spec first (including the golden test vectors), then the implementation.

**Add a golden test vector:** Add the row to the README's Golden Test Vectors table with expected values. If the score is derived (not hand-computed), mark it `—`.

**Add a booster:** Define the booster's signal, when it fires, and which paths it applies to. Add it to the README's Concepts section (user-facing) and to `boosters.ts` (implementation). Add test vectors that exercise the booster in isolation and in combination with existing boosters. Check for double-counting — does the new booster overlap with an existing one?

**Modify the assignment algorithm:** Update the Greedy with Repair section in this file first. The algorithm has two phases (seed and repair) — be explicit about which phase you're changing and why. Add test cases for the greedy-versus-compact tension.

**Verify the scoring walkthrough:** The `cfg` / `Config` = 63 and `cr` / `configReload` = 53 derivations in the README are normative. If the implementation produces different scores, the implementation has a bug.
