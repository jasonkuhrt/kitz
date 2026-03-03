// FAIL: imports impl.ts directly, bypassing bar/_.ts wall
import { barImpl } from './bar/impl.js'

export const x = barImpl
