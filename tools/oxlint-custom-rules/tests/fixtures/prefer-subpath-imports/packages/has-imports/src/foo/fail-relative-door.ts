// FAIL: #bar subpath import exists, so relative import to _.ts is not allowed
import { Bar } from '../bar/_.js'

export const x = Bar
