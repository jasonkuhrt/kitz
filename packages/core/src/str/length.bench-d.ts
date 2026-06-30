import type { Length } from './length.js'

// Type-instantiation regression cases (previously gated via @ark/attest bench).
// Kept as type aliases so tsc still exercises them; instantiation-count gating
// will be reintroduced via a bun-native tool in a follow-up.

type _baseline = Length<'baseline'>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Fast Path Performance (0-20 chars)
type _Fast_empty = Length<''>
type _Fast_1 = Length<'a'>
type _Fast_5 = Length<'hello'>
type _Fast_10 = Length<'helloworld'>
type _Fast_15 = Length<'123456789012345'>
type _Fast_20 = Length<'12345678901234567890'>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Gate Check (>20 chars, no flag)
type _Gate_21 = Length<'123456789012345678901'>
type _Gate_50 = Length<'12345678901234567890123456789012345678901234567890'>
type _Gate_100 =
  Length<'1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890'>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Real-world Patterns
type _Real_variable = Length<'myVariable'>
type _Real_function = Length<'processUserData'>
type _Real_error_key = Length<'ERROR'>
type _Real_padded_key = Length<'expected______'>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Slow Path Benchmarks (with local override)
type _Slow_21 = Length<'123456789012345678901', true>
type _Slow_50 = Length<'12345678901234567890123456789012345678901234567890', true>
type _Slow_100 = Length<
  '1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890',
  true
>
type _Slow_500 = Length<
  '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890',
  true
>
