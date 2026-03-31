import { Test } from '@kitz/test'
import { hasMatch } from './has-match.js'

Test.on(hasMatch)
  // dprint-ignore
  .cases(
    // Empty needle matches anything
    [['', 'anything'], true],
    [['', ''], true],
    // Non-empty needle against empty haystack fails
    [['x', ''], false],
    [['abc', ''], false],
    // Subsequence match passes
    [['cfg', 'Config'], true],
    [['cr', 'configReload'], true],
    [['abc', 'abc'], true],
    // Out-of-order characters pass (multiset containment)
    [['vdi', 'david'], true],
    [['rc', 'configReload'], true],
    [['ba', 'ab'], true],
    // Missing characters fail
    [['cxg', 'Config'], false],
    [['xyz', 'hello'], false],
    // Multiplicity is respected
    [['ll', 'reload'], false], // only one l
    [['ll', 'llama'], true], // two l's
    [['aab', 'abba'], true], // two a's and one b
    [['aab', 'abc'], false], // only one a
    // Case insensitive
    [['CFG', 'config'], true],
    [['cfg', 'CONFIG'], true],
    [['AbC', 'abc'], true],
    // Needle longer than haystack fails
    [['abcdef', 'abc'], false],
    [['hello', 'hi'], false],
  )
  .test()
