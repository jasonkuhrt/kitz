import type * as Err from './err.js'

type _baseline = Err.StaticError<'baseline'>

// Type-instantiation regression cases (previously gated via @ark/attest bench).
// Kept as type aliases so tsc still exercises them; instantiation-count gating
// will be reintroduced via a bun-native tool in a follow-up.
type _StaticError_n_metadata = Err.StaticError<'Invalid operation'>
type _StaticError_y_metadata = Err.StaticError<
  'Type mismatch',
  { expected: 'string'; actual: 'number' }
>
