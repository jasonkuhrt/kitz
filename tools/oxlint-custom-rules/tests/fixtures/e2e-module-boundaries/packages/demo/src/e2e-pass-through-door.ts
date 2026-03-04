// PASS: importing through the namespace door (no deep import violation)
// Note: this WILL be flagged by prefer-subpath-imports, but NOT by no-deep-imports
import { Alpha } from './alpha/_.js'

export const x = Alpha
