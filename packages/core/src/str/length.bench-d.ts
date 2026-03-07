import { bench } from '@ark/attest'
import type { Length } from './length.js'

//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Baseline
//
//
//

type _baseline = Length<'baseline'>

//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Fast Path Performance (0-20 chars)
//
//
//

bench('Length > Fast > Empty string', () => {
  return {} as Length<''>
}).types([11, 'instantiations'])

bench('Length > Fast > 1 char', () => {
  return {} as Length<'a'>
}).types([29, 'instantiations'])

bench('Length > Fast > 5 chars', () => {
  return {} as Length<'hello'>
}).types([101, 'instantiations'])

bench('Length > Fast > 10 chars', () => {
  return {} as Length<'helloworld'>
}).types([197, 'instantiations'])

bench('Length > Fast > 15 chars', () => {
  return {} as Length<'123456789012345'>
}).types([302, 'instantiations'])

bench('Length > Fast > 20 chars (boundary)', () => {
  return {} as Length<'12345678901234567890'>
}).types([407, 'instantiations'])

//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Gate Check (>20 chars, no flag)
//
//
//

bench('Length > Gate > 21 chars (exceeds limit)', () => {
  return {} as Length<'123456789012345678901'>
}).types([1150, 'instantiations'])

bench('Length > Gate > 50 chars', () => {
  return {} as Length<'12345678901234567890123456789012345678901234567890'>
}).types([1150, 'instantiations'])

bench('Length > Gate > 100 chars', () => {
  return {} as Length<'1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890'>
}).types([1150, 'instantiations'])

//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Real-world Patterns
//
//
//

// Common identifier lengths
bench('Length > Real-world > Variable name', () => {
  return {} as Length<'myVariable'>
}).types([197, 'instantiations'])

bench('Length > Real-world > Function name', () => {
  return {} as Length<'processUserData'>
}).types([302, 'instantiations'])

// Key names
bench('Length > Real-world > Error key', () => {
  return {} as Length<'ERROR'>
}).types([101, 'instantiations'])

bench('Length > Real-world > Padded key', () => {
  return {} as Length<'expected______'>
}).types([281, 'instantiations'])

//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Slow Path Benchmarks (with local override)
//
//
//

// 21 chars with local override
bench('Length > Slow > 21 chars', () => {
  return {} as Length<'123456789012345678901', true>
}).types([363, 'instantiations'])

// 50 chars with local override
bench('Length > Slow > 50 chars', () => {
  return {} as Length<'12345678901234567890123456789012345678901234567890', true>
}).types([449, 'instantiations'])

// 100 chars with local override
bench('Length > Slow > 100 chars', () => {
  return {} as Length<
    '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890',
    true
  >
}).types([614, 'instantiations'])

// 500 chars with local override
bench('Length > Slow > 500 chars', () => {
  return {} as Length<
    '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890',
    true
  >
}).types([1914, 'instantiations'])
