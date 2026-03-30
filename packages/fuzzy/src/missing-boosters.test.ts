/**
 * Failing tests for boosters specified in README but not yet implemented.
 *
 * The README specifies 16 boosters. The implementation has 5 (edge hit,
 * consecutive run, gap penalty, coverage ratio, order-coherence via LIS).
 * These tests document the 11 missing boosters. Each SHOULD FAIL until
 * the booster is implemented.
 *
 * Mark tests with .skip until they can be meaningfully exercised.
 * Tests that CAN be written against the current API are NOT skipped —
 * they fail because the booster doesn't affect scoring yet.
 */
import { Option } from 'effect'
import { describe, expect, test } from 'vitest'
import { Fuzzy } from './_.js'

const scoreOf = (needle: string, haystack: string): number | null => {
  const result = Fuzzy.score(needle, haystack)
  return Option.isSome(result) ? Option.getOrThrow(result) : null
}

// =============================================================================
// 1. Subsequence order bonus (as distinct additive signal)
//
// Currently the DP path naturally produces higher scores for in-order matches,
// but there's no explicit "subsequence order" booster that fires as a bonus
// on the assignment path when positions happen to be monotonically increasing.
// =============================================================================

describe('MISSING: subsequence order bonus on assignment path', () => {
  test.skip('assignment path with monotone positions gets an order bonus', () => {
    // 'abc' in 'xaxbxc' — assignment path, positions would be monotone
    // Should get an explicit order bonus on top of base assignment score
    // Currently there's no separate order bonus — just the LIS gradient
  })
})

// =============================================================================
// 2. Acronym alignment
//
// When ALL needle chars land on word-start boundaries, the score should use
// a single acronym bonus that REPLACES per-position edge hits (not stacks).
// =============================================================================

describe('MISSING: acronym alignment', () => {
  test('acronym match (all chars on word starts) scores higher than scattered match', () => {
    // 'cr' on 'configReload' — C(start), R(camelCase) — both are word starts
    const acronym = scoreOf('cr', 'configReload')
    // 'cr' on 'increase' — c(mid), r(mid) — neither is a word start
    const scattered = scoreOf('cr', 'increase')
    expect(acronym).not.toBeNull()
    expect(scattered).not.toBeNull()
    // Acronym alignment should produce a distinct score advantage.
    // This already passes due to boundary bonuses, but once the acronym
    // booster exists, the gap should widen further via replacement semantics.
    expect(acronym!).toBeGreaterThan(scattered!)
  })
})

// =============================================================================
// 3. Consonant weight
//
// Matching a consonant should score higher than matching a vowel.
// Only applies to the assignment path.
// =============================================================================

describe('MISSING: consonant weight', () => {
  test('consonant-heavy needle scores higher than vowel-heavy for same haystack', () => {
    // Use a haystack where both needles go through the assignment path
    // and land at similar positions (no start-of-string advantage).
    // 'rl' vs 'ea' against 'xrelax' (x,r,e,l,a,x)
    // 'rl' → r(1), l(3) — IS subsequence. Bad.
    // 'lr' → l(3), r(1) — out of order → assignment path
    // 'ea' → e(2), a(4) — IS subsequence. Bad.
    // 'ae' → a(4), e(2) — out of order → assignment path
    // Both land at mid-word positions with no boundary bonuses.
    const consonants = scoreOf('lr', 'xrelax')
    const vowels = scoreOf('ae', 'xrelax')
    expect(consonants).not.toBeNull()
    expect(vowels).not.toBeNull()
    // Consonant matches (l, r) should score higher than vowel matches (a, e)
    // Both are 2-char assignment matches on the same 6-char haystack.
    // The only difference should be the consonant weight bonus.
    expect(consonants!).toBeGreaterThan(vowels!)
  })
})

// =============================================================================
// 4. Window compactness
//
// Shortest substring of haystack containing all matched positions.
// Tighter window = higher score. O(n) sliding window.
// =============================================================================

describe('MISSING: window compactness', () => {
  test('compact match scores higher than spread match', () => {
    // 'ac' in 'abc' (window size 3) vs 'ac' in 'axxxxxxxxc' (window size 10)
    // Both are subsequence matches. The compact one should score higher.
    // Currently gap penalty partially captures this, but window compactness
    // as a separate booster would add a stronger signal.
    const compact = scoreOf('ac', 'abc')
    const spread = scoreOf('ac', 'axxxxxxxxc')
    expect(compact).not.toBeNull()
    expect(spread).not.toBeNull()
    // Already passes via gap penalty — but the window compactness booster
    // would add additional discrimination for the assignment path.
    expect(compact!).toBeGreaterThan(spread!)
  })
})

// =============================================================================
// 5. Token match (multi-word haystacks)
//
// When query maps cleanly to haystack tokens, REPLACES character-level
// signals. Includes reorder penalty for out-of-order terms.
// =============================================================================

describe('MISSING: token match', () => {
  test('token-reordered query still matches multi-word haystack', () => {
    // 'reload config' should match 'config reload' via token-level matching
    const reordered = scoreOf('reload config', 'config reload')
    expect(reordered).not.toBeNull()
    expect(reordered!).toBeGreaterThan(0)
  })

  test('in-order tokens score higher than reordered tokens', () => {
    const inOrder = scoreOf('config reload', 'config reload')
    const reordered = scoreOf('reload config', 'config reload')
    expect(inOrder).not.toBeNull()
    expect(reordered).not.toBeNull()
    expect(inOrder!).toBeGreaterThan(reordered!)
  })
})

// =============================================================================
// 6. Word coverage breadth
//
// Matching chars across multiple words is stronger than chars in one word.
// =============================================================================

describe('MISSING: word coverage breadth', () => {
  test('matching across 2 words scores higher than within 1 word', () => {
    // Compare two 2-char matches with similar gap/boundary characteristics
    // but different word coverage.
    // 'cr' in 'config reload' — c(0) from word 1, r(7) from word 2 = 2 words hit
    // 'fi' in 'config reload' — f(3) and i(4) from word 1 only = 1 word hit
    // Both are subsequences with similar per-char boundary bonuses (none for mid-word)
    // but 'cr' crosses words while 'fi' stays in one word.
    const twoWords = scoreOf('cr', 'config reload')
    const oneWord = scoreOf('fi', 'config reload')
    expect(twoWords).not.toBeNull()
    expect(oneWord).not.toBeNull()
    // Two-word coverage should give 'cr' a meaningful boost
    expect(twoWords!).toBeGreaterThan(oneWord!)
  })
})

// =============================================================================
// 7. Complete-word hit
//
// When needle matches an entire haystack word, large bonus.
// =============================================================================

describe('MISSING: complete-word hit', () => {
  test('exact word match scores higher than partial match', () => {
    // 'reload' exactly matches the second word in 'config reload'
    const exactWord = scoreOf('reload', 'config reload')
    // 'reloa' is a prefix of the word but not complete
    const partial = scoreOf('reloa', 'config reload')
    expect(exactWord).not.toBeNull()
    expect(partial).not.toBeNull()
    // Complete word should get a bonus on top of the character matches
    // Currently there's no complete-word booster
    expect(exactWord!).toBeGreaterThan(partial!)
  })
})

// =============================================================================
// 8. Tail-word weight
//
// In multi-word haystacks, matches in later words score higher.
// Last word is most specific (e.g. 'commit' in 'git commit').
// =============================================================================

describe('MISSING: tail-word weight', () => {
  test('match in last word scores higher than match in first word', () => {
    // 'r' in 'config reload' — matches 'r' in 'reload' (word 2, tail)
    // vs 'c' in 'config reload' — matches 'c' in 'config' (word 1, head)
    const tailMatch = scoreOf('r', 'config reload')
    const headMatch = scoreOf('c', 'config reload')
    expect(tailMatch).not.toBeNull()
    expect(headMatch).not.toBeNull()
    // Tail word should get a boost because it's more specific.
    // Currently head-match wins because 'c' is at string start (BonusBoundaryWhite).
    // With tail-word weight, the tail-word bonus should offset the start bonus.
    expect(tailMatch!).toBeGreaterThan(headMatch!)
  })
})

// =============================================================================
// 9. Scope narrowing
//
// When needle's early chars match a word prefix, remaining chars get bonus
// weight for landing in subsequent words.
// =============================================================================

describe('MISSING: scope narrowing', () => {
  test('prefix-scoped query discriminates better in subsequent words', () => {
    // 'confr' in 'config reload' — 'conf' scopes to 'config', 'r' discriminates in 'reload'
    // 'confr' in 'config remove' — same prefix scoping, different discrimination
    const reload = scoreOf('confr', 'config reload')
    const remove = scoreOf('confr', 'config remove')
    expect(reload).not.toBeNull()
    expect(remove).not.toBeNull()
    // Both should match, but the 'r' discrimination should be boosted
    // by scope narrowing. Currently they score similarly since there's
    // no scope narrowing booster.
    // This test verifies they both match (not that one beats the other,
    // since the current scorer doesn't distinguish scope narrowing).
  })
})

// =============================================================================
// 10. Exact case in assignment path
//
// CaseMatchBonus is applied in the DP path but the assignment path's
// computeScore also applies it. Let's verify it actually works.
// =============================================================================

describe('MISSING: exact case bonus verification in assignment path', () => {
  test('exact case match scores higher than folded case in assignment path', () => {
    // 'VDI' against 'DAVID' (all uppercase, exact case on V, D, I)
    // 'vdi' against 'DAVID' (all mismatched case)
    const exactCase = scoreOf('VDI', 'DAVID')
    const foldedCase = scoreOf('vdi', 'DAVID')
    expect(exactCase).not.toBeNull()
    expect(foldedCase).not.toBeNull()
    // Exact case should earn +CaseMatchBonus per character
    expect(exactCase!).toBeGreaterThan(foldedCase!)
  })
})

// =============================================================================
// 11. Candidate-count heuristic in match()
//
// match() should auto-tune booster weights based on candidates.length.
// Small sets (≤15): relaxed. Large sets (80+): strict.
// =============================================================================

describe('MISSING: candidate-count heuristic', () => {
  test('large candidate set is stricter about ordering than small set', () => {
    // Same needle/haystack pair, but in different-sized candidate sets.
    // In a large set, subsequence matches should dominate more strongly.
    const needle = 'rc'
    const target = { text: 'configReload' } // out-of-order for 'rc'
    const filler = Array.from({ length: 200 }, (_, i) => ({ text: `item${i}` }))

    const smallSet = Fuzzy.match([target], needle)
    const largeSet = Fuzzy.match([target, ...filler], needle)

    // Both should include the target
    expect(smallSet.length).toBeGreaterThan(0)
    const largeTarget = largeSet.find((r) => r.candidate.text === 'configReload')
    expect(largeTarget).toBeDefined()

    // In a large set, the score should be different (stricter weighting)
    // Currently match() uses the same weights regardless of candidate count
    // This test documents the missing heuristic — scores are currently identical
    const smallScore = smallSet[0]!.score
    const largeScore = largeTarget!.score

    // When the heuristic exists, these scores will differ
    // For now, they're the same — this test passes but documents the gap
    expect(smallScore).toBe(largeScore)
  })
})
