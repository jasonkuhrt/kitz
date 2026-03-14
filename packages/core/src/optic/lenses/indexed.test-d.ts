import { Assert } from '#kitz/assert'
import type { Result } from 'effect'
import type * as Indexed from './indexed.js'

//
// Get - extracts value type from index signatures
//

// Record<string, T> → T
Assert.exact.ofAs<Result.Success<number, never>>().onAs<Indexed.Get<Record<string, number>>>()

// { [k: string]: T } → T
Assert.exact.ofAs<Result.Success<string, never>>().onAs<Indexed.Get<{ [k: string]: string }>>()

// Mixed: explicit props + index signature → union
Assert.exact
  .ofAs<Result.Success<number | string, never>>()
  .onAs<Indexed.Get<{ name: string; [k: string]: number | string }>>()

// Error: no index signature
Assert.exact
  .ofAs<Result.Failure<never, Indexed.LensErrorNoIndexSignature<{ name: string }>>>()
  .onAs<Indexed.Get<{ name: string }>>()

// Error: empty object (no index signature)
Assert.exact
  .ofAs<Result.Failure<never, Indexed.LensErrorNoIndexSignature<object>>>()
  .onAs<Indexed.Get<object>>()

//
// Set - replaces value type in index signature
//

// Record<string, T> with new value type
Assert.exact.ofAs<{ [x: string]: boolean }>().onAs<Indexed.Set<Record<string, number>, boolean>>()

// { [k: string]: T } with new value type
Assert.exact.ofAs<{ [x: string]: number }>().onAs<Indexed.Set<{ [k: string]: string }, number>>()

// No index signature → never
Assert.exact.ofAs<never>().onAs<Indexed.Set<{ name: string }, boolean>>()

//
// HKT interface
//

// $Get has correct parameters shape
Assert.exact.ofAs<[$T: unknown]>().onAs<Indexed.$Get['parameters']>()

// $Set has correct parameters shape
Assert.exact.ofAs<[$T: unknown, $New: unknown]>().onAs<Indexed.$Set['parameters']>()
