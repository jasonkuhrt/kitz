import { bench, describe } from 'vitest'
import { Fuzzy } from './_.js'

// =============================================================================
// Benchmarks: measure hot-path performance for command-palette scale usage
//
// Target: <5ms for 500 candidates (10µs per candidate)
// =============================================================================

// Generate realistic command palette candidates
const commandCandidates = [
  'config reload', 'config export', 'config import', 'config reset',
  'git commit', 'git push', 'git pull', 'git checkout', 'git merge',
  'git rebase', 'git stash', 'git status', 'git log', 'git diff',
  'file open', 'file save', 'file close', 'file rename', 'file delete',
  'toggle sidebar', 'toggle terminal', 'toggle minimap', 'toggle breadcrumbs',
  'search files', 'search text', 'search symbols', 'search references',
  'window split', 'window close', 'window maximize', 'window minimize',
  'debug start', 'debug stop', 'debug step', 'debug continue',
  'format document', 'format selection', 'refactor rename', 'refactor extract',
  'view explorer', 'view search', 'view source control', 'view extensions',
  'terminal new', 'terminal clear', 'terminal kill', 'terminal split',
  'editor fold', 'editor unfold', 'editor indent', 'editor outdent',
].map(text => ({ text }))

// 500 candidates for realistic scale
const largeCandidates = Array.from({ length: 500 }, (_, i) => ({
  text: `command${i} action${i % 10} variant${i % 5}`,
}))

describe('hasMatch', () => {
  bench('50 candidates, short needle', () => {
    for (const c of commandCandidates) {
      Fuzzy.hasMatch('cr', c.text)
    }
  })

  bench('500 candidates, short needle', () => {
    for (const c of largeCandidates) {
      Fuzzy.hasMatch('cr', c.text)
    }
  })
})

describe('score — subsequence path', () => {
  bench('50 candidates, 2-char needle', () => {
    for (const c of commandCandidates) {
      Fuzzy.score('cr', c.text)
    }
  })

  bench('50 candidates, 4-char needle', () => {
    for (const c of commandCandidates) {
      Fuzzy.score('cfrl', c.text)
    }
  })
})

describe('score — assignment path', () => {
  bench('50 candidates, 3-char out-of-order needle', () => {
    for (const c of commandCandidates) {
      Fuzzy.score('rfc', c.text)
    }
  })
})

describe('match — full pipeline', () => {
  bench('50 candidates, short query', () => {
    Fuzzy.match(commandCandidates, 'cr')
  })

  bench('500 candidates, short query', () => {
    Fuzzy.match(largeCandidates, 'cr')
  })

  bench('50 candidates, out-of-order query', () => {
    Fuzzy.match(commandCandidates, 'rc')
  })

  bench('500 candidates, 4-char query', () => {
    Fuzzy.match(largeCandidates, 'cmda')
  })
})

describe('positions', () => {
  bench('single pair, subsequence', () => {
    Fuzzy.positions('cfg', 'Config')
  })

  bench('single pair, out-of-order', () => {
    Fuzzy.positions('vdi', 'david')
  })
})
