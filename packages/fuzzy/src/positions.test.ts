import { Test } from '@kitz/test'
import { Option } from 'effect'
import { positions } from './positions.js'

const unwrap = (needle: string, haystack: string) => {
  const result = positions(needle, haystack)
  return Option.isSome(result) ? Option.getOrThrow(result) : null
}

Test.describe('positions — normative golden vectors')
  .on(unwrap)
  // dprint-ignore
  .cases(
    [['cfg', 'Config'],        [0, 3, 5]],
    [['cr', 'configReload'],   [0, 6]],
    [['', 'anything'],         []],
  )
  .test()

Test.describe('positions — no match returns null')
  .on(unwrap)
  // dprint-ignore
  .cases(
    [['cxg', 'Config'],  null],
    [['ll', 'reload'],   null],
    [['x', ''],          null],
  )
  .test()

Test.describe('positions — out-of-order matches return positions in needle order')
  .on((needle: string, haystack: string) => {
    const result = unwrap(needle, haystack)
    return result !== null ? result.length : null
  })
  // dprint-ignore
  .cases(
    [['vdi', 'david'], 3],
    [['ba', 'ab'],     2],
    [['cba', 'abc'],   3],
  )
  .test()
