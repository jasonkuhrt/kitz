import { describe, expect, test } from 'vitest'
import { Bench } from 'tinybench'
import { Fuzzy } from './_.js'

// =============================================================================
// Performance gate — fuzzy matching on hot path
//
// Uses tinybench Bench directly for statistically rigorous measurement.
//
// Scenario: command palette with 500 candidates, realistic queries.
// Budget: <5ms p99 for `match()` (the full pipeline: hasMatch + score + sort).
// Rationale: at 120Hz the frame budget is ~8.3ms. The fuzzy match is the
// dominant cost in a keystroke cycle. 5ms leaves ~3ms for scope computation,
// shortcut filtering, rendering, and framework overhead.
//
// For detailed profiling tables: bun run --cwd packages/fuzzy bench
// =============================================================================

// --- Fixtures ----------------------------------------------------------------

const commandCandidates = [
  'config reload',
  'config export',
  'config import',
  'config reset',
  'git commit',
  'git push',
  'git pull',
  'git checkout',
  'git merge',
  'git rebase',
  'git stash',
  'git status',
  'git log',
  'git diff',
  'file open',
  'file save',
  'file close',
  'file rename',
  'file delete',
  'toggle sidebar',
  'toggle terminal',
  'toggle minimap',
  'toggle breadcrumbs',
  'search files',
  'search text',
  'search symbols',
  'search references',
  'window split',
  'window close',
  'window maximize',
  'window minimize',
  'debug start',
  'debug stop',
  'debug step',
  'debug continue',
  'format document',
  'format selection',
  'refactor rename',
  'refactor extract',
  'view explorer',
  'view search',
  'view source control',
  'view extensions',
  'terminal new',
  'terminal clear',
  'terminal kill',
  'terminal split',
  'editor fold',
  'editor unfold',
  'editor indent',
  'editor outdent',
].map((text) => ({ text }))

const largeCandidates = Array.from({ length: 500 }, (_, i) => ({
  text: `command${i} action${i % 10} variant${i % 5}`,
}))

// --- Performance gates -------------------------------------------------------

// CI runners are shared VMs, ~10x slower than local dev machines.
// Thresholds are calibrated for CI (the primary enforcement surface).
// Observed CI baselines: match=12ms, hasMatch=7ms, score=4ms, positions<1ms.
// Thresholds set at ~3x observed to allow for VM variance without
// being so loose they miss real regressions.
const IS_CI = !!process.env['CI']

describe('fuzzy performance gate', () => {
  const MATCH_BUDGET_P99_MS = IS_CI ? 40 : 5

  test(`match() 500 candidates < ${MATCH_BUDGET_P99_MS}ms p99`, async () => {
    const b = new Bench({
      time: 500,
      warmupTime: 200,
      warmupIterations: 50,
    })

    b.add('match 500, short query', () => {
      Fuzzy.match(largeCandidates, 'cr')
    })

    b.add('match 500, 4-char query', () => {
      Fuzzy.match(largeCandidates, 'cmda')
    })

    b.add('match 50, out-of-order query', () => {
      Fuzzy.match(commandCandidates, 'rc')
    })

    await b.warmup()
    await b.run()

    const short = b.getTask('match 500, short query')!.result!
    const fourChar = b.getTask('match 500, 4-char query')!.result!
    const outOfOrder = b.getTask('match 50, out-of-order query')!.result!

    console.log(
      [
        `\n  Fuzzy match performance:`,
        `    500 candidates, 2-char : mean=${short.mean.toFixed(3)}ms  p99=${short.p99.toFixed(3)}ms  hz=${short.hz.toFixed(0)}`,
        `    500 candidates, 4-char : mean=${fourChar.mean.toFixed(3)}ms  p99=${fourChar.p99.toFixed(3)}ms  hz=${fourChar.hz.toFixed(0)}`,
        `    50 candidates, OOO     : mean=${outOfOrder.mean.toFixed(3)}ms  p99=${outOfOrder.p99.toFixed(3)}ms  hz=${outOfOrder.hz.toFixed(0)}`,
        `    budget: ${MATCH_BUDGET_P99_MS}ms p99`,
      ].join('\n'),
    )

    // Gate: each scenario must stay within budget at p99
    expect(
      short.p99,
      `500/short p99 ${short.p99.toFixed(3)}ms exceeds ${MATCH_BUDGET_P99_MS}ms`,
    ).toBeLessThan(MATCH_BUDGET_P99_MS)

    expect(
      fourChar.p99,
      `500/4-char p99 ${fourChar.p99.toFixed(3)}ms exceeds ${MATCH_BUDGET_P99_MS}ms`,
    ).toBeLessThan(MATCH_BUDGET_P99_MS)

    expect(
      outOfOrder.p99,
      `50/OOO p99 ${outOfOrder.p99.toFixed(3)}ms exceeds ${MATCH_BUDGET_P99_MS}ms`,
    ).toBeLessThan(MATCH_BUDGET_P99_MS)
  })

  test('hasMatch 500 candidates < 1ms p99', async () => {
    const b = new Bench({
      time: 500,
      warmupTime: 200,
      warmupIterations: 50,
    })

    b.add('hasMatch 500', () => {
      for (const c of largeCandidates) {
        Fuzzy.hasMatch('cr', c.text)
      }
    })

    await b.warmup()
    await b.run()

    const result = b.getTask('hasMatch 500')!.result!

    console.log(
      `\n  hasMatch 500 candidates: mean=${result.mean.toFixed(3)}ms  p99=${result.p99.toFixed(3)}ms  hz=${result.hz.toFixed(0)}`,
    )

    const HAS_MATCH_BUDGET = IS_CI ? 20 : 1
    expect(
      result.p99,
      `hasMatch p99 ${result.p99.toFixed(3)}ms exceeds ${HAS_MATCH_BUDGET}ms`,
    ).toBeLessThan(HAS_MATCH_BUDGET)
  })

  test('score 50 candidates < 1ms p99', async () => {
    const b = new Bench({
      time: 500,
      warmupTime: 200,
      warmupIterations: 50,
    })

    b.add('score 50, 2-char', () => {
      for (const c of commandCandidates) {
        Fuzzy.score('cr', c.text)
      }
    })

    b.add('score 50, 4-char', () => {
      for (const c of commandCandidates) {
        Fuzzy.score('cfrl', c.text)
      }
    })

    await b.warmup()
    await b.run()

    const twoChar = b.getTask('score 50, 2-char')!.result!
    const fourChar = b.getTask('score 50, 4-char')!.result!

    console.log(
      [
        `\n  Score 50 candidates:`,
        `    2-char: mean=${twoChar.mean.toFixed(3)}ms  p99=${twoChar.p99.toFixed(3)}ms  hz=${twoChar.hz.toFixed(0)}`,
        `    4-char: mean=${fourChar.mean.toFixed(3)}ms  p99=${fourChar.p99.toFixed(3)}ms  hz=${fourChar.hz.toFixed(0)}`,
      ].join('\n'),
    )

    const SCORE_BUDGET = IS_CI ? 15 : 1
    expect(
      twoChar.p99,
      `score/2-char p99 ${twoChar.p99.toFixed(3)}ms exceeds ${SCORE_BUDGET}ms`,
    ).toBeLessThan(SCORE_BUDGET)
    expect(
      fourChar.p99,
      `score/4-char p99 ${fourChar.p99.toFixed(3)}ms exceeds ${SCORE_BUDGET}ms`,
    ).toBeLessThan(SCORE_BUDGET)
  })

  test('positions < 0.1ms p99 per pair', async () => {
    const b = new Bench({
      time: 500,
      warmupTime: 200,
      warmupIterations: 100,
    })

    b.add('positions subsequence', () => {
      Fuzzy.positions('cfg', 'Config')
    })

    b.add('positions out-of-order', () => {
      Fuzzy.positions('vdi', 'david')
    })

    await b.warmup()
    await b.run()

    const subseq = b.getTask('positions subsequence')!.result!
    const ooo = b.getTask('positions out-of-order')!.result!

    console.log(
      [
        `\n  Positions per pair:`,
        `    subsequence : mean=${subseq.mean.toFixed(4)}ms  p99=${subseq.p99.toFixed(4)}ms  hz=${subseq.hz.toFixed(0)}`,
        `    out-of-order: mean=${ooo.mean.toFixed(4)}ms  p99=${ooo.p99.toFixed(4)}ms  hz=${ooo.hz.toFixed(0)}`,
      ].join('\n'),
    )

    const POS_BUDGET = IS_CI ? 1 : 0.1
    expect(subseq.p99, `positions/subseq p99 exceeds ${POS_BUDGET}ms`).toBeLessThan(POS_BUDGET)
    expect(ooo.p99, `positions/ooo p99 exceeds ${POS_BUDGET}ms`).toBeLessThan(POS_BUDGET)
  })
})
