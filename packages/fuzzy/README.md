# @kitz/fuzzy

Fuzzy string matching that scores how well characters land on word boundaries, camelCase transitions, and delimiters. Ordering is a strong scoring signal, not a hard requirement.

## Grounding

Fuzzy matching scores how well a short search string (the "needle") aligns against a longer candidate (the "haystack"). Two open-source tools dominate the space. [fzy](https://github.com/jhawthorn/fzy) (used by GitHub.com's command palette) finds the mathematically optimal alignment using dynamic programming with two matrices. [fzf](https://github.com/junegunn/fzf) (used by millions of terminal users) classifies characters into seven semantic classes and awards graduated bonuses when matches land at transitions between them. Both require needle characters to appear in order.

## Problem

JavaScript fuzzy matching libraries either score matches without fine-grained character-class awareness (they cannot distinguish matching at a camelCase transition from matching mid-word) or exist only as bindings to native fzf. No existing JavaScript library combines fzy's optimal alignment with fzf's scoring.

All of these matchers share a deeper limitation: they require the needle's characters to appear in order within the haystack. This creates a **zero-results cliff** — typing `vdi` returns nothing for `david`, because `v` does not precede `d` in the haystack. The result set goes from populated to empty because of a single ordering mistake. For command palettes and autocomplete, where the user's mental model is "I know these letters are in the target," this cliff feels broken. Even a low-confidence match is better than no match.

## Solution

`@kitz/fuzzy` uses fzy's two-matrix DP core with fzf's seven character classes and graduated bonus table, implemented ground-up in TypeScript on Effect. When the needle's characters appear in order, the DP finds the mathematically optimal alignment — the same gold-standard algorithm every command palette uses. When they don't appear in order but are present in the haystack, a secondary scoring path assigns characters to their best available positions and scores the result. The match gate is [`multiset containment`](#multiset-containment) (are the characters present?), not subsequence order (are they in order?). This eliminates the zero-results cliff: a scrambled query produces a low score, not an empty list.

Scores are built from multiple [`boosters`](#booster) — independent signals that fire when their conditions are met. Ordering is one booster among many. A subsequence match scores higher in practice (because the order booster fires), but an out-of-order match still returns a score, and the consumer decides the display threshold.

The motivating consumer is [`@kitz/cmx`](../cmx/README.md), which uses fuzzy matching for command palette resolution. Effect is used at the API boundary (`Option` for match results, pipe-friendly function signatures) but not in the scoring hot loop.

## Quickstart

```bash
npm install @kitz/fuzzy
```

```typescript
import { Fuzzy } from '@kitz/fuzzy'
import { Option, pipe } from 'effect'

// Subsequence match — characters in order (high score)
Fuzzy.score('cfg', 'Config')        // Option.some(63)

// Order-independent match — characters present, not in order (lower score)
Fuzzy.score('vdi', 'david')         // Option.some(<score>)

// Characters not present — no match
Fuzzy.score('xyz', 'Config')        // Option.none()

// Multiset containment check (fast path, no scoring)
Fuzzy.hasMatch('vdi', 'david')      // true  (v, d, i all present)
Fuzzy.hasMatch('ll', 'reload')      // false (only one l)

// Match positions for UI highlighting
Fuzzy.positions('cfg', 'Config')    // Option.some([0, 3, 5])

// Pipe-friendly curried variants
pipe('Config', Fuzzy.score('cfg'))  // Option.some(63)

// Batch: score, sort, auto-tune for set size
Fuzzy.match(
  [{ text: 'david' }, { text: 'provide' }, { text: 'xyz' }],
  'vdi',
)
// [
//   { candidate: { text: 'david' }, score: ... },
//   { candidate: { text: 'provide' }, score: ... },
// ]
// 'xyz' excluded — characters missing

// Consumer boost: external signals folded into the score
Fuzzy.match(
  [
    { text: 'config reload', boost: 10 },  // nearby command
    { text: 'thread create', boost: 2 },   // far command
  ],
  'cr',
)
```

## Concepts

A **needle** is the search string the user typed. A **haystack** is a candidate string being matched against. The first question fuzzy matching answers is whether the needle's characters exist in the haystack at all.

[`Multiset containment`](#multiset-containment) is the match gate. Every needle character must exist in the haystack with at least the same multiplicity. `vdi` passes against `david` because d(×1), v(×1), i(×1) are all present. `ll` fails against `reload` because the haystack has only one `l`. This replaces the stricter "subsequence" check used by traditional matchers — characters must be present, but not necessarily in order. [`hasMatch`](#api-overview) answers this in O(n + m) time.

When multiset containment passes, the scorer determines *how good* the match is using one of two paths. If the needle's characters appear in order within the haystack (a subsequence), the **subsequence path** fires — fzy's two-matrix DP with fzf's scoring, finding the mathematically optimal alignment. For the vast majority of queries, this is the path taken. If the characters are present but not in subsequence order, the **assignment path** fires — each needle character is assigned to a haystack position, favoring word boundaries, and the result is scored using the same bonus system. The assignment path is a fallback that prevents empty results, not a competing scorer.

Both paths produce a set of matched positions. The score is built from [`boosters`](#booster) — independent signals evaluated on those positions.

**Position-quality boosters** reward characters that land at meaningful locations. An **edge hit** fires when a matched character lands at a [`character class`](#character-class) transition — the `R` in `configReload` (camelCase transition, +7) scores higher than the `o` in `configReload` (mid-word, +0). The start of the string is treated as if preceded by whitespace, so position 0 always earns the strongest boundary bonus. An **exact case** bonus (+1) fires when the needle character's case matches the haystack character's case. **Consonant weight** scores consonant matches higher than vowel matches — consonants carry more information in English identifiers and command names.

**Structure boosters** reward recognizable patterns. The **subsequence order** booster fires when all matched positions are in monotonically increasing order — meaning the needle is actually a subsequence. This is the primary discriminator: a subsequence match outscores an otherwise-identical non-subsequence match. The **order-coherence gradient** measures how close to in-order the positions are for non-subsequence matches: a single transposition scores much better than a full reversal. **Acronym alignment** fires when all needle characters land on word-start boundaries (e.g., `cr` → **C**onfig**R**eload). Acronym alignment **replaces** per-position edge hits with a single acronym score when higher — it does not stack.

**Density boosters** reward matches that explain the haystack compactly. **Coverage ratio** (`needle_len / haystack_len`) rewards short haystacks where the needle explains most of the string — `cfg` against `Config` (3/6 = 50%) beats `cfg` against `configurable` (3/12 = 25%). **Window compactness** measures the shortest substring of the haystack containing all matched positions. **Gap penalty** penalizes distance between positions using an affine model: the first skip is expensive, continuing to skip is cheaper. **Consecutive run** rewards adjacent matched positions.

**Token-level boosters** fire for multi-word haystacks (commands with spaces, paths with delimiters). **Token match** fires when the query maps cleanly to haystack tokens, with a reorder penalty for out-of-order terms — `reload config` matches `config reload` but scores below the in-order version. Token match **replaces** character-level signals when a clean token mapping exists — it does not stack. **Word coverage breadth** rewards matches that touch multiple words: matching 1 character in each of 3 words is stronger evidence than 3 characters in 1 word. A **complete-word hit** fires when the needle matches an entire haystack word — the user directly named the action. **Tail-word weight** scores matches in later words higher, because in command paths the last word is the most specific (`commit` differentiates more than `git`). **Scope narrowing** gives bonus weight when the needle's early characters match a word prefix and its remaining characters land in subsequent words — recognizing `gitc` as `git` (scoping) + `c` (discriminating).

### Character classes

Every haystack character is classified into one of seven classes:

| Class | Characters | Examples |
| --- | --- | --- |
| White | space, tab, newline | ` `, `\t` |
| Delimiter | `-`, `_`, `/` | kebab-case, snake_case, paths |
| NonWord | `.`, `,`, `:`, `;`, `!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `+`, `=`, `'`, `"`, `~`, `` ` ``, `\|`, `\`, `?`, `<`, `>`, `(`, `)`, `[`, `]`, `{`, `}` | punctuation, operators |
| Lower | `a`–`z` | lowercase ASCII |
| Upper | `A`–`Z` | uppercase ASCII |
| Letter | unicode letters (non-ASCII) | accented, CJK |
| Number | `0`–`9` | digits |

Scoring depends on the **transition** between adjacent classes. Matching at a whitespace boundary (+10), delimiter boundary (+9), camelCase transition (+7), or generic boundary (+8) earns a bonus. Mid-word matches earn no boundary bonus. The start of a string is treated as if preceded by a White character.

### Consumer boost

Candidates passed to [`match()`](#api-overview) may include an optional `boost` field. This number is folded into the final score alongside the internal boosters. Fuzzy does not interpret the boost — it's a generic channel for external signals. A command palette might pass proximity (closer commands get higher boost). A file finder might pass recency. The consumer controls the magnitude; fuzzy incorporates it additively.

```typescript
Fuzzy.match(
  [
    { text: 'config reload', boost: 10 },  // close to user's position
    { text: 'global help', boost: 0 },     // far away
  ],
  'cr',
)
// 'config reload' gets its match score + 10
// 'global help' gets its match score + 0
```

### Score semantics

The score is a continuous number, not a boolean. `Option.none()` means the characters aren't present (multiset containment failed). `Option.some(3)` means a weak match. `Option.some(85)` means a strong match. The consumer decides display thresholds:

```typescript
const results = Fuzzy.match(commands, query)
for (const { candidate, score } of results) {
  if (score > 50) render(candidate, { confidence: 'high' })
  else if (score > 15) render(candidate, { dimmed: true })
  else render(candidate, { grayed: true })
}
```

### Candidate-count heuristic

[`match()`](#api-overview) auto-tunes booster weights based on `candidates.length`. Small sets (≤15) are tuned for recall — the order booster weighs less, so out-of-order matches score closer to subsequence matches. Large sets (80+) are tuned for precision — the order booster weighs more, density signals tighten. [`score()`](#api-overview) uses default weights (no candidate count available). This is internal — not exposed as configuration.

## Usage

### Pre-filtering with hasMatch

`hasMatch` checks multiset containment with no scoring overhead — O(n + m) time, zero allocations. Use it to pre-filter before calling `score` or `positions` on surviving candidates.

```typescript
import { Array, Option, pipe } from 'effect'

const candidates = getAllCommands()

const matches = pipe(
  candidates,
  Array.filter(c => Fuzzy.hasMatch(query, c.text)),
  Array.filterMap(c =>
    pipe(
      Fuzzy.score(query, c.text),
      Option.map(score => ({ candidate: c, score })),
    )
  ),
  Array.sortBy(({ score: a }, { score: b }) => b - a),
)
```

### Highlighting matched characters

`positions` returns the haystack indices where needle characters were assigned, in needle order (position[0] = where needle[0] matched). For subsequence matches, these are the optimal DP alignment positions. For out-of-order matches, these are the greedy+repair assignment positions.

```typescript
Option.map(Fuzzy.positions('cr', 'configReload'), indices => {
  // indices = [0, 6] → **C**onfig**R**eload
})
```

### Batch matching

`match` combines filtering, scoring, and sorting. Candidates that fail multiset containment are excluded. Results are sorted highest-first with stable tie-breaking.

```typescript
Fuzzy.match(
  [
    { text: 'Config reload', id: 'cmd-1', keybinding: 'Ctrl+R' },
    { text: 'Config export', id: 'cmd-2', keybinding: 'Ctrl+E' },
  ],
  'cr',
)
// Extra fields pass through untouched
```

## Behavioral Contract

**Empty needle.** `hasMatch('', x)` returns `true`. `score('', x)` returns `Option.some(0)`. `positions('', x)` returns `Option.some([])`. `match(candidates, '')` returns all candidates with score `0`, in input order.

**Empty haystack.** `hasMatch('x', '')` returns `false`. `score('x', '')` returns `Option.none()`.

**No match.** `score` returns `Option.none()` when the needle fails multiset containment (characters missing or insufficient multiplicity). `match` excludes the candidate.

**Out-of-order match.** `score` returns `Option.some(<score>)` when the needle passes multiset containment but is not a subsequence. The score is lower than a comparable subsequence match.

**Consumer boost.** Candidates may include an optional `boost` field (number). When present, it is folded into the final score. Consumers use this to inject external signals — proximity, recency, frequency — without post-hoc score combination. Fuzzy does not interpret the boost semantically.

**Case folding.** ASCII-only. `a`–`z` and `A`–`Z` are folded. No Unicode case folding or normalization.

**Candidate-count tuning.** `match` adjusts internal booster weights based on candidate count. `score` uses default weights.

## Divergences from Upstream fzf

| Aspect | Upstream fzf | @kitz/fuzzy |
| --- | --- | --- |
| Delimiter characters | `/`, `,`, `:`, `;`, `\|` | `-`, `_`, `/` |
| `-` and `_` classification | NonWord | Delimiter |
| `,`, `:`, `;`, `\|` classification | Delimiter | NonWord |
| `CaseMatchBonus` | does not exist | +1 for exact-case match |
| Ordering requirement | Hard — subsequence only | Soft — booster, not gate |
| Match gate | Subsequence check | Multiset containment |
| Scoring schemes | `default`, `path`, `history` | Single scheme for command palette / structured names |

## API Overview

| Export | Signature | Purpose |
| --- | --- | --- |
| `hasMatch` | `(needle, haystack) => boolean` | Multiset containment check, no scoring |
| `score` | `(needle, haystack) => Option<number>` | Best score (`None` = containment fails) |
| `positions` | `(needle, haystack) => Option<ReadonlyArray<number>>` | Matched indices (`None` = no match) |
| `match` | `<T extends { text: string; boost?: number }>(candidates, query) => ReadonlyArray<{ candidate: T; score: number }>` | Batch score + sort with candidate-count heuristic |

All functions are pure. Data-first and data-last (curried) forms for `pipe` compatibility. The only dependency is `effect` (for `Option`).

### Scoring Constants (exported)

| Constant | Value |
| --- | --- |
| `ScoreMatch` | 16 |
| `ScoreGapStart` | −3 |
| `ScoreGapExtension` | −1 |
| `BonusBoundaryWhite` | 10 |
| `BonusBoundaryDelimiter` | 9 |
| `BonusBoundary` | 8 |
| `BonusNonWord` | 8 |
| `BonusCamel123` | 7 |
| `BonusConsecutive` | 4 |
| `BonusFirstCharMultiplier` | 2 |
| `CaseMatchBonus` | 1 |

### Golden Test Vectors

Normative — the implementation must produce these exact results.

| Needle | Haystack | hasMatch | score | positions | Path |
| --- | --- | --- | --- | --- | --- |
| `cfg` | `Config` | true | Some(63) | Some([0, 3, 5]) | Subsequence |
| `cxg` | `Config` | false | None | None | — |
| `cr` | `configReload` | true | Some(53) | Some([0, 6]) | Subsequence |
| `` | `anything` | true | Some(0) | Some([]) | — |
| `x` | `` | false | None | None | — |
| `vdi` | `david` | true | Some(—) | Some(—) | Assignment |
| `ll` | `reload` | false | None | None | — |
| `abc` | `cba` | true | Some(—) | Some(—) | Assignment |
| `abc` | `acb` | true | Some(—) | Some(—) | Assignment |

Scores marked `—` are implementation-derived. `cfg`/`Config` = 63 and `cr`/`configReload` = 53 are hand-computed and normative.

## Glossary

#### assignment path

The scoring path activated when the needle passes [`multiset containment`](#multiset-containment) but is not a subsequence. Assigns needle characters to haystack positions favoring word boundaries, then scores the positions using the same [`boosters`](#booster) as the [`subsequence path`](#subsequence-path).

#### booster

An independent scoring signal that contributes to the total score when its condition is met. Boosters are additive. Ordering is one booster among many. See [Concepts](#concepts).

#### boost

An optional numeric field on candidates passed to [`match()`](#api-overview). Folded into the final score alongside internal [`boosters`](#booster). Consumers use this to inject external signals (proximity, recency, frequency) without fuzzy knowing what they mean.

#### boundary bonus

Score awarded when a matched character lands at a transition between [`character classes`](#character-class).

#### character class

One of seven categories every character is classified into. The transition between adjacent classes determines [`boundary bonuses`](#boundary-bonus).

#### multiset containment

The match gate. Every needle character must exist in the haystack with at least the same multiplicity. Replaces the stricter subsequence check. This is the change that eliminates the [`zero-results cliff`](#zero-results-cliff).

#### needle

The search string the user typed.

#### haystack

The candidate string being matched against.

#### positions

The haystack indices where needle characters were matched. Used by UIs to highlight matched characters.

#### subsequence path

The primary scoring path, activated when the needle's characters appear in order within the haystack. Uses fzy's two-matrix DP with fzf's scoring constants to find the optimal alignment.

#### zero-results cliff

The failure mode where a single character-ordering mistake causes the result set to go from populated to empty. `@kitz/fuzzy` eliminates it by gating on [`multiset containment`](#multiset-containment) instead of subsequence order.

## Credits

See [Credits](docs/credits.md) for lineage, studied implementations, and academic foundations.
