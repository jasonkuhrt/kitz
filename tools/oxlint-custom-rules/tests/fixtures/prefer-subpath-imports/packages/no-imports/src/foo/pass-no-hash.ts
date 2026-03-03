// PASS: no #imports field in package.json, so relative import to _.ts is allowed
import { Bar } from '../bar/_.js'

export const x = Bar
