import { Test } from '@kitz/test'
import { hasMatch } from './has-match.js'

Test.on(hasMatch)
  .describeInputs('empty needle matches anything', [
    ['', 'anything'],
    ['', ''],
  ])
  .describeInputs('non-empty needle against empty haystack fails', [
    ['x', ''],
    ['abc', ''],
  ])
  .describeInputs('subsequence match passes', [
    ['cfg', 'Config'],
    ['cr', 'configReload'],
    ['abc', 'abc'],
  ])
  .describeInputs('out-of-order characters pass (multiset containment)', [
    ['vdi', 'david'],
    ['rc', 'configReload'],
    ['ba', 'ab'],
  ])
  .describeInputs('missing characters fail', [
    ['cxg', 'Config'],
    ['xyz', 'hello'],
  ])
  .describeInputs('multiplicity is respected', [
    ['ll', 'reload'],   // only one l → false
    ['ll', 'llama'],    // two l's → true
    ['aab', 'abba'],    // two a's and one b → true
    ['aab', 'abc'],     // only one a → false
  ])
  .describeInputs('case insensitive', [
    ['CFG', 'config'],
    ['cfg', 'CONFIG'],
    ['AbC', 'abc'],
  ])
  .describeInputs('needle longer than haystack fails', [
    ['abcdef', 'abc'],
    ['hello', 'hi'],
  ])
  .test()
