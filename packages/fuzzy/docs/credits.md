# Credits

`@kitz/fuzzy` stands on the work of others. The algorithm is not novel — it combines two proven approaches and adapts them for JavaScript. This section records the main direct inputs and notable implementations consulted during design.

## Direct inputs

These are the projects whose code, constants, or algorithmic ideas are directly used in `@kitz/fuzzy`.

**[fzy](https://github.com/jhawthorn/fzy)** by John Hawthorn (2014, MIT). The two-matrix DP formulation — M for best overall score, D for best score ending in a match — comes from fzy. Hawthorn describes fzy's scorer as a dynamic-programming formulation similar to Needleman-Wunsch/Wagner-Fischer, with a second matrix [inspired by Gotoh's affine-gap formulation](https://doi.org/10.1016/0022-2836(82)90398-9), as documented in fzy's [`ALGORITHM.md`](https://github.com/jhawthorn/fzy/blob/master/ALGORITHM.md). fzy's scoring uses float-valued constants (`SCORE_MATCH_CONSECUTIVE = 1.0`, `SCORE_MATCH_WORD = 0.8`, etc.) and a simpler bonus system (slash, word boundary, capital, dot). `@kitz/fuzzy` takes the two-matrix structure but replaces fzy's scoring constants with fzf's.

**[fzf](https://github.com/junegunn/fzf)** by Junegunn Choi (2013, MIT). The seven character classes (White, NonWord, Delimiter, Lower, Upper, Letter, Number), the graduated bonus table (`scoreMatch = 16`, `bonusBoundaryWhite = 10`, `bonusCamel123 = 7`, etc.), the consecutive chunk rule (`max(currentBonus, firstBonusInChunk, bonusConsecutive)`), and the `bonusFirstCharMultiplier` all come from fzf's `FuzzyMatchV2` in [`src/algo/algo.go`](https://github.com/junegunn/fzf/blob/master/src/algo/algo.go). fzf describes its V2 algorithm as "a modified version of Smith-Waterman." `@kitz/fuzzy` adapts the character class membership for command/path contexts (see [Divergences from upstream fzf](../README.md#divergences-from-upstream-fzf)) but preserves all numeric constants unchanged.

## Studied implementations

These projects were studied during design. They influenced understanding of the problem space, validated algorithmic choices, or demonstrated approaches we chose not to take.

**[nucleo](https://github.com/helix-editor/nucleo)** by Pascal Kuthe (Rust, MPL-2.0). Used by the Helix editor. nucleo implements fzf's scoring system with a more faithful Smith-Waterman two-matrix formulation than fzf itself (fzf uses one matrix; nucleo uses two). Its implementation suggests that the consecutive chunk rule can be simplified in the greedy/scoring path, and that `BONUS_CAMEL123` could be `BONUS_BOUNDARY - PENALTY_GAP_START` (= 5 in nucleo) rather than fzf's `BONUS_BOUNDARY + SCORE_GAP_EXTENSION` (= 7). `@kitz/fuzzy` follows fzf's value (7) for ranking compatibility, but nucleo's analysis informed the trade-off. nucleo also demonstrates the greedy fallback for very long haystacks (O(n) with O(1) space).

**[frizbee](https://github.com/saghen/frizbee)** by Liam Dyer (Rust, MIT). SIMD-accelerated Smith-Waterman fuzzy matcher used by blink.cmp and skim. Combines fzf's gap model with fzy's scoring bonuses. Frizbee's row-wise SIMD parallelism demonstrates that the Smith-Waterman matrix structure is naturally vectorizable — relevant for a future WASM path, though `@kitz/fuzzy` targets scalar JS for now. Frizbee also adds typo resistance (allowing substitutions), which `@kitz/fuzzy` does not.

**[skim / fuzzy-matcher](https://github.com/lotabout/fuzzy-matcher)** by Jinzhou Zhang (Rust, MIT). skim's `fuzzy-matcher` crate implements Smith-Waterman with affine gaps directly. Its `clangd`-style scorer (separate from the skim scorer) confirmed that the algorithm family applies well to structured identifiers, not just file paths.

**[fzf-for-js](https://github.com/ajitid/fzf-for-js)** by Ajit (TypeScript, MIT). A JavaScript port of fzf's V1 and V2 algorithms. Studied to understand what a direct fzf port looks like in JS and where it falls short (it ports fzf's single-matrix V2, not the two-matrix formulation). `@kitz/fuzzy` takes a different approach: fzy's two-matrix DP with fzf's scoring, rather than porting fzf's V2 directly.

**[fuzzaldrin-plus](https://github.com/jeancroy/fuzzaldrin-plus)** by Jean Christophe Roy. Originally built for Atom editor. One of the first JS fuzzy matchers to use Smith-Waterman (noted in fzy's ALGORITHM.md). Demonstrated that optimal alignment matters for code navigation, validating the choice of an O(nm) algorithm over greedy approaches.

**[lib_fts](https://github.com/forrestthewoods/lib_fts)** by Forrest Smith (C++/JS, public domain). Smith's 2016 blog post ["Reverse Engineering Sublime Text's Fuzzy Match"](https://www.forrestthewoods.com/blog/reverse_engineering_sublime_texts_fuzzy_match/) is the most widely-read explanation of how fuzzy matching scoring works. His reference implementation demonstrates the recursive approach with camelCase, separator, and consecutive bonuses. `@kitz/fuzzy` uses a DP approach instead of recursion, but lib_fts helped popularize the heuristic vocabulary used in many editor-oriented fuzzy matchers.

**[flx](https://github.com/lewang/flx)** by Le Wang (Emacs Lisp, GPL). Emacs fuzzy matching "à la Sublime Text." Balances abbreviation matching (word beginnings) against contiguous substring matching. Its aggressive caching strategy (10 MB for 10k filenames) illustrates the quality/speed trade-offs that DP-based matchers like fzy address differently. `@kitz/fuzzy` follows the DP path rather than flx's cached-heuristic path.

## Historical lineage

These projects established the editor fuzzy-finding paradigm that fzy and fzf refined. `@kitz/fuzzy` does not use their code or algorithms directly, but they are part of the lineage that shaped the problem space.

**[TextMate](https://macromates.com/)** by Allan Odgaard (2004). fzy's [`ALGORITHM.md`](https://github.com/jhawthorn/fzy/blob/master/ALGORITHM.md) gives TextMate "immense credit" for popularizing fuzzy file finding inside editors. TextMate's ranker (`Frameworks/text/src/ranker.cc`) introduced separator-aware and boundary-centric ranking heuristics that the entire command-palette/file-finder ecosystem inherited.

**[command-t](https://github.com/wincent/command-t)** by Greg Hurrell (2010). A Vim port of TextMate's "Go to File" behavior, cited in fzy's `ALGORITHM.md`. command-t's README describes ranking matches higher when they occur in salient locations such as immediately after path separators — the same principle behind fzf's character-class bonuses.

**[selecta](https://github.com/garybernhardt/selecta)** by Gary Bernhardt. A minimal fuzzy finder discussed in fzy's `ALGORITHM.md` as a baseline algorithm family. selecta ranks by shortest matching substring with special handling for word boundaries, exact runs, and acronyms — the heuristic approach that fzy's optimal-alignment DP was designed to improve upon.

## Academic foundations

The algorithms used in fuzzy text matching originate in bioinformatics sequence alignment.

**Needleman, S.B. & Wunsch, C.D. (1970).** "A general method applicable to the search for similarities in the amino acid sequence of two proteins." *Journal of Molecular Biology*, 48(3):443–453. [doi:10.1016/0022-2836(70)90057-4](https://doi.org/10.1016/0022-2836(70)90057-4). The original global alignment algorithm using dynamic programming. fzy uses a global-alignment-style DP over subsequence matching with affine-gap treatment that traces to this structure.

**Smith, T.F. & Waterman, M.S. (1981).** "Identification of common molecular subsequences." *Journal of Molecular Biology*, 147(1):195–197. [doi:10.1016/0022-2836(81)90087-5](https://doi.org/10.1016/0022-2836(81)90087-5). Local alignment variant that allows ignoring non-matching regions (negative cells set to zero). fzf's V2 algorithm is explicitly described as "a modified version of Smith-Waterman." The key adaptation for fuzzy matching: omission/mismatch of pattern characters is not allowed, only insertion of haystack characters (gaps).

**Gotoh, O. (1982).** "An improved algorithm for matching biological sequences." *Journal of Molecular Biology*, 162(3):705–708. [doi:10.1016/0022-2836(82)90398-9](https://doi.org/10.1016/0022-2836(82)90398-9). Introduced affine gap penalties (separate cost for opening vs. extending a gap) computable in O(mn) time using an additional matrix. fzy's D matrix is an adaptation of Gotoh's affine-gap formulation to the constrained fuzzy-matching setting, as noted in fzy's ALGORITHM.md.

## Lineage

```
Needleman-Wunsch (1970)      Smith-Waterman (1981)
           \                  /
            Gotoh (1982, affine-gap DP)
                 /                    \
        fzy (two-matrix DP)      fzf V2 (character-class scoring)
                 \                    /
                  @kitz/fuzzy (fzy DP + fzf scoring)

Parallel implementations drawing from the same lineage:
  nucleo  — fzf scoring + faithful two-matrix Smith-Waterman
  frizbee — Smith-Waterman + fzf/fzy hybrid scoring + SIMD
```
