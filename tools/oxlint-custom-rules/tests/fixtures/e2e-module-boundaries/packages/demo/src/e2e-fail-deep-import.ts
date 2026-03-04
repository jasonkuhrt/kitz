// FAIL: bypasses alpha/ wall by importing impl directly
import { value } from './alpha/impl.js'

export const x = value
