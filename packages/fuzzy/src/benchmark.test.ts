import { describe, expect, test } from 'vitest'
import { Bench } from 'tinybench'
import { Fuzzy } from './_.js'

// =============================================================================
// Performance gate — fuzzy matching on hot path
//
// Uses tinybench Bench directly for statistically rigorous measurement.
//
// Scenario: command palette with 500 candidates, realistic queries.
//
// Local gates use MEAN (robust to OS scheduling jitter, GC pauses, background
// CPU load). CI gates use P99 (controlled VM, reliable tail latency enforcement).
// Both are always reported in diagnostic output for comparison.
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
// Local: gate on mean (stable across background load).
// CI: gate on p99 (controlled environment, catches tail latency regressions).
// Observed CI baselines: match=12ms, hasMatch=7ms, score=4ms, positions<1ms.
const IS_CI = !!process.env['CI']

/**
 * Assert that a benchmark result stays within budget.
 * Local: checks mean (robust to jitter). CI: checks p99 (strict tail latency).
 */
const assertWithinBudget = (
  result: { mean: number; p99: number },
  label: string,
  budget: { localMean: number; ciP99: number },
) => {
  if (IS_CI) {
    expect(
      result.p99,
      `${label} p99 ${result.p99.toFixed(3)}ms exceeds CI budget ${budget.ciP99}ms`,
    ).toBeLessThan(budget.ciP99)
  } else {
    expect(
      result.mean,
      `${label} mean ${result.mean.toFixed(3)}ms exceeds local budget ${budget.localMean}ms`,
    ).toBeLessThan(budget.localMean)
  }
}

describe('fuzzy performance gate', () => {
  const MATCH_BUDGET = { localMean: 8, ciP99: 40 }

  test('match() 500 candidates within budget', async () => {
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
        `    budget: ${IS_CI ? `p99 < ${MATCH_BUDGET.ciP99}ms` : `mean < ${MATCH_BUDGET.localMean}ms`}`,
      ].join('\n'),
    )

    assertWithinBudget(short, '500/short', MATCH_BUDGET)
    assertWithinBudget(fourChar, '500/4-char', MATCH_BUDGET)
    assertWithinBudget(outOfOrder, '50/OOO', MATCH_BUDGET)
  })

  const HAS_MATCH_BUDGET = { localMean: 1, ciP99: 20 }

  test('hasMatch 500 candidates within budget', async () => {
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

    assertWithinBudget(result, 'hasMatch', HAS_MATCH_BUDGET)
  })

  const SCORE_BUDGET = { localMean: 1, ciP99: 15 }

  test('score 50 candidates within budget', async () => {
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

    assertWithinBudget(twoChar, 'score/2-char', SCORE_BUDGET)
    assertWithinBudget(fourChar, 'score/4-char', SCORE_BUDGET)
  })

  const POS_BUDGET = { localMean: 0.05, ciP99: 1 }

  test('positions within budget per pair', async () => {
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

    assertWithinBudget(subseq, 'positions/subseq', POS_BUDGET)
    assertWithinBudget(ooo, 'positions/ooo', POS_BUDGET)
  })
})
