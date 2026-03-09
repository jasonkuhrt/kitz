// PASS: same-directory import to __.ts is structural, not a consumer pattern
import { barValue } from './__.js'

export const x = barValue
