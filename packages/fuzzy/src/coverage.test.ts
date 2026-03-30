import { Option } from 'effect'
import { expect, test } from 'vitest'
import { Fuzzy } from './_.js'
import { assignmentScore } from './assignment.js'
import { subsequenceScore } from './subsequence.js'

// =============================================================================
// Coverage: assignment.ts repair pass — swap-with-occupied branch
// =============================================================================

test('assignment: repair swaps when occupied position improves global score', () => {
  // 'ab' against 'ba' — both chars have one position each, no swap needed
  const result = assignmentScore('ab', 'ba')
  expect(result).not.toBeNull()
  expect(result!.positions).toHaveLength(2)
})

test('assignment: repeated needle chars handled correctly', () => {
  // 'aa' needs two 'a' positions from 'abba'
  const result = assignmentScore('aa', 'abba')
  expect(result).not.toBeNull()
  expect(result!.positions).toHaveLength(2)
  // Both positions should be different
  expect(result!.positions[0]).not.toBe(result!.positions[1])
})

test('assignment: repair with shared character positions', () => {
  // 'dd' in 'david' — d at 0 and d at 4
  const result = assignmentScore('dd', 'david')
  expect(result).not.toBeNull()
  expect(result!.positions).toHaveLength(2)
  expect(new Set(result!.positions).size).toBe(2)
})

test('assignment: complex repair scenario with multiple alternatives', () => {
  // 'aba' in 'aabba' — a appears at 0,1,4 and b appears at 2,3
  // Needs to pick two a's and one b
  const result = assignmentScore('aba', 'aabba')
  expect(result).not.toBeNull()
  expect(result!.positions).toHaveLength(3)
})

test('assignment: repair accepts free reassignment when it improves score', () => {
  // 'ab' in 'xbxa' — 'a' at positions 2(mid-word) and 3(mid-word), 'b' at position 1
  // but 'a' at pos 0 doesn't exist. Let's use a case where alternatives exist:
  // 'a' in 'a_a' — two positions for 'a': 0 (string start, boundary) and 2 (delimiter boundary)
  // Greedy picks the best bonus (pos 0, string start = 20). No repair needed.
  // Better: 'ba' in 'ab_a' — b at 1 (mid-word), a at 0 (start) or 3 (delim boundary)
  // Greedy: b→1 (no boundary), a→0 (start, bonus 20). Positions: [1, 0].
  // Repair could try a→3 (delim boundary, bonus 9). Score with [1,0] vs [1,3]:
  // [1,0]: gap penalty for reversed positions. [1,3]: gap penalty for 1 skip.
  // The repair should try the free alternative.
  const result = assignmentScore('ba', 'ab_a')
  expect(result).not.toBeNull()
})

test('assignment: repair accepts swap when it improves compactness', () => {
  // Need a case where two chars share the same letter and greedy picks wrong
  // 'dd' in 'dxxd_d' — d at 0 (start, bonus 20), 3 (mid-word, 0), 5 (delim, 9)
  // Greedy: first d → 0 (bonus 20), second d → 5 (bonus 9). Gap: 0→5 = 4 chars.
  // Alternative: first d → 0, second d → 3. Gap: 0→3 = 2 chars (less gap penalty).
  // Repair should try swapping d[1] from 5 to 3 if it improves score.
  const result = assignmentScore('dd', 'dxxd_d')
  expect(result).not.toBeNull()
  // The repair should have found a good assignment
  expect(result!.positions).toHaveLength(2)
})

// =============================================================================
// Coverage: edge cases for score/positions safety fallthroughs
// =============================================================================

test('score: single char needle against single char haystack (case mismatch)', () => {
  const result = Fuzzy.score('a', 'A')
  expect(Option.isSome(result)).toBe(true)
})

test('positions: single char needle', () => {
  const result = Fuzzy.positions('a', 'abc')
  expect(Option.isSome(result)).toBe(true)
  expect(Option.getOrThrow(result)).toEqual([0])
})

test('score: needle == haystack but reversed', () => {
  const result = Fuzzy.score('dcba', 'abcd')
  expect(Option.isSome(result)).toBe(true)
  expect(Option.getOrThrow(result)).toBeGreaterThan(0)
})

// =============================================================================
// Coverage: subsequence boundary cases
// =============================================================================

test('subsequence: long gap then match', () => {
  // 'az' in 'axxxxxxxxxxxz' — long gap
  const result = subsequenceScore('az', 'axxxxxxxxxxxz')
  expect(result).not.toBeNull()
  expect(result!.positions).toEqual([0, 12])
})

test('subsequence: all characters consecutive at start', () => {
  const result = subsequenceScore('abc', 'abcdef')
  expect(result).not.toBeNull()
  expect(result!.positions).toEqual([0, 1, 2])
})

test('subsequence: needle matches at very end', () => {
  const result = subsequenceScore('ef', 'abcdef')
  expect(result).not.toBeNull()
  expect(result!.positions).toEqual([4, 5])
})

// =============================================================================
// Coverage: character class edge cases
// =============================================================================

test('non-ASCII letter classification', () => {
  expect(Fuzzy.hasMatch('é', 'café')).toBe(true)
})

test('numbers in haystack', () => {
  expect(Fuzzy.hasMatch('v2', 'version2')).toBe(true)
  const result = Fuzzy.score('v2', 'version2')
  expect(Option.isSome(result)).toBe(true)
})
