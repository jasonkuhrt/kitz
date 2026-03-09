// PASS: using # subpath import (no relative path to check)
// Note: oxlint can't resolve #alpha, but the rule only flags relative imports
// so this should produce no warnings for prefer-subpath-imports
import { Alpha } from '#alpha'

export const x = Alpha
