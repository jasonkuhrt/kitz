// FAIL: #alpha exists in package.json but using relative path to door
import { Alpha } from './alpha/_.js'

export const x = Alpha
