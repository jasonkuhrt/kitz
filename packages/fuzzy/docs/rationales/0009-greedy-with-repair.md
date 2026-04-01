# 0009: Greedy-with-Repair Assignment over Hungarian Algorithm

## Context

The assignment path needs to select which haystack positions to assign to each needle character. This is a selection/assignment problem. Three approaches were considered:

**Brute-force permutation:** Try all orderings of the needle characters against all candidate positions. Correct but factorial cost — O(k!) where k is needle length. Manageable for k ≤ 4 (24 permutations) but unusable for k ≥ 6 (720+).

**Hungarian algorithm:** Solves the optimal one-to-one assignment in O(k³) for a k×k cost matrix. Polynomial and well-studied. Used in bipartite matching for approximate string comparison (Buss et al.).

**Greedy-with-repair:** Greedy seed assigns each needle character to the highest-bonus available position. A repair pass swaps repeated-character assignments when swaps improve the global score.

## Decision

Use **greedy-with-repair**. The Hungarian algorithm is not the right optimizer for this problem.

**Why not Hungarian:**
- Hungarian solves **linear** (additive) assignment: minimize the sum of per-edge costs. But the scoring model includes **pairwise interactions** — window compactness, gap penalties, consecutive runs, order coherence — that depend on the *set* of chosen positions, not individual position costs.
- Once the objective has pairwise terms, the problem becomes Quadratic Assignment (QAP), which is NP-hard. Hungarian doesn't solve QAP.
- For command-length strings (5–30 chars) with short needles (2–8 chars), Hungarian's O(k³) is not a performance problem — it's a correctness problem. It optimizes the wrong objective.

**Why greedy-with-repair works:**
- The greedy seed gets most assignments right: the highest-bonus position for each character is usually the correct one. Cross-character competition only arises with repeated characters.
- The repair pass fixes the main failure mode: greedy chasing a strong but distant boundary when a weaker but compact cluster scores better globally. The `cab` → `bac  a` example is the canonical case — greedy picks the late boundary `a`, repair recognizes the compact cluster `bac` at {0,1,2} is better.
- The repair evaluates the full booster suite (including pairwise signals) on each candidate swap. This captures compactness, adjacency, and order coherence that Hungarian cannot express in its cost matrix.
- For typical inputs (needle 2–8 chars, haystack 5–30 chars), the repair pass tries at most O(k × p) swaps where p is the average alternative positions per character. This is sub-millisecond.

**Why not brute-force:**
- Only viable for very short needles. Needle length 5 → 120 permutations × full booster evaluation per permutation. For 500 candidates, that's 60,000 evaluations.
- Greedy-with-repair achieves near-optimal quality at O(k²) cost rather than O(k!).

## Result

The assignment path runs in O(n × m) for the seed and O(k² × n) for the repair. For command-palette use (50–500 candidates, needles 2–8 chars, haystacks 5–30 chars), the full pipeline (multiset gate → DP attempt → assignment fallback → booster evaluation) runs well under 5ms.
