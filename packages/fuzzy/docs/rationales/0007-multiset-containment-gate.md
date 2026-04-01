# 0007: Multiset Containment as Match Gate

## Context

Traditional fuzzy matchers (fzy, fzf, VS Code, Sublime Text) require the needle's characters to appear in subsequence order within the haystack. This is the standard approach and works well for power users who learn subsequence shorthands. However, it creates a **zero-results cliff**: a single character-ordering mistake causes the result set to go from populated to empty. Typing `vdi` returns nothing for `david` because `v` does not precede `d` in the haystack.

Research confirmed this gap is real. Two independent research passes (using gpt-5.4) surveyed 20+ launchers, command palettes, and fuzzy finders. None perform order-independent single-token character matching. The closest behaviors are token-level reordering (fzf's space-separated terms, Slack Quick Switcher's substring reordering) and typo tolerance (Damerau-Levenshtein transpositions in Fuse.js). No tool relaxes character order within a single unspaced token.

The established theory for order-independent character scoring (Jaccard, Dice) handles the match/no-match decision but not position-aware scoring. The combination of set-based matching with boundary-aware scoring (camelCase, delimiter, whitespace transitions) is genuinely novel territory — no standard published scorer exists for this exact problem.

## Decision

Replace the subsequence check with **multiset containment** as the match gate. Every needle character must exist in the haystack with at least the same multiplicity. Characters present → some score (possibly low). Characters missing → no match (`Option.none()`). Ordering becomes a booster that contributes to the score, not a prerequisite for matching.

## Result

- The zero-results cliff is eliminated. A scrambled query produces a low score, not an empty list.
- The consumer decides display thresholds. A score of 3 can be rendered dimmed/grayed. The library doesn't make UX decisions.
- False positive risk increases for short queries against large candidate sets. This is mitigated by the candidate-count heuristic (auto-tuning booster weights) and by the subsequence order booster strongly favoring in-order matches.
- `hasMatch` semantics change from "is the needle a subsequence?" to "does the haystack contain all needle characters?"
- The algorithm family shifts from pure sequence alignment (Smith-Waterman/Gotoh lineage) to a hybrid of sequence alignment (subsequence path) and assignment/matching (assignment path).
