# 0008: Booster-Based Scoring over Lane Architecture

## Context

With ordering relaxed as a hard gate (ADR 0007), the scoring model needs to handle both in-order and out-of-order matches on a single comparable scale. Two architectures were considered:

**Lane/tier architecture:** Match types are ranked by precedence (exact > prefix > subsequence > acronym > token-permutation > reject). Each lane has its own scoring model. A match in a higher lane always outranks a match in a lower lane. This is the approach recommended by the first Codex review.

**Booster architecture:** The score is built from independent additive signals ("boosters") that each fire when their condition is met. Ordering is one booster among many. A subsequence match scores higher because the order booster fires, but the architecture is fundamentally additive rather than precedence-based.

## Decision

Use the **booster architecture**. Ordering is a soft signal, not a hard gate.

**Why not lanes:**
- Lanes re-introduce the "subsequence or nothing" rigidity at each boundary. A match that falls just below a lane boundary gets zero credit for almost qualifying.
- Lanes require discrete categorization of every match into one type. Real matches are often hybrids — partial subsequence with one inversion, or acronym-like with one non-boundary hit.
- Lanes make it impossible for a very strong out-of-order match to outrank a very weak subsequence match, which doesn't match user intuition.
- Lane boundaries are weight-sensitive: a single constant determines whether a match is "tier 2" or "tier 3," creating cliff effects that are hard to tune.

**Why boosters work:**
- Boosters self-adapt to haystack structure. Multi-word haystacks naturally activate token-level boosters. Single-token haystacks activate camelCase/delimiter boosters. No mode switch needed.
- The candidate-count heuristic modulates booster weights based on set size, achieving the precision/recall tradeoff that lanes enforce rigidly.
- A subsequence match still strongly outscores a non-subsequence match in practice because the subsequence order booster contributes a large positive signal. The difference is principled (earned by actual ordering quality) rather than architectural (assigned by lane membership).

**Risks:**
- Double-counting: overlapping boosters can overweight the same evidence. Mitigated by replacement semantics (acronym replaces edge hits, token match replaces char-level signals) rather than naive addition.
- Score normalization: the subsequence path (DP) has a per-character base that must be subtracted before cross-path comparison. Without normalization, subsequence matches win by construction due to a branch-specific offset.
- Weight tuning: 16 boosters with relative weights is a larger tuning surface than 5 lanes with hard boundaries. Mitigated by grouping correlated boosters (density cluster: compactness + gap + consecutive) and tuning groups rather than individual weights.

## Result

The scorer produces a single comparable number for any needle/haystack pair. Consumers don't need to understand match types — they sort by score and apply display thresholds. The order booster provides a principled advantage to subsequence matches without creating a hard boundary that discards non-subsequence evidence.
