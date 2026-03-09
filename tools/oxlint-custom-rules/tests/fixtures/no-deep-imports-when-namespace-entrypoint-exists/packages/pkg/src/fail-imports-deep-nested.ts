// FAIL: imports deep-impl.ts, bypassing bar/_.ts wall (recursive)
import { deepImpl } from './bar/baz/deep-impl.js'

export const x = deepImpl
