import { Type as A } from '#kitz/assert/assert'
import { Obj } from '#obj'

// Fixtures
type a = { name: string; age: number }
type b = { name: string; age: number; extra: boolean }
type c = { profile: a }
type d = { profile: b }
type e = { timestamp: Date; count: number }
type f = { timestamp: Date; count: number; extra: boolean }

// Basic
A.exact.ofAs<a>().onAs<Obj.NoExcess<a, a>>()
A.exact.ofAs<{ name: string; age: number; extra: never }>().onAs<Obj.NoExcess<b, a>>()

// Nested
A.exact.ofAs<c>().onAs<Obj.NoExcess<c, c>>()
A.exact.ofAs<{ profile: { name: string; age: number; extra: never } }>().onAs<Obj.NoExcess<d, c>>()

// Preserved types
A.exact.ofAs<e>().onAs<Obj.NoExcess<e, e>>()
A.exact.ofAs<{ timestamp: Date; count: number; extra: never }>().onAs<Obj.NoExcess<f, e>>()
A.exact.ofAs<{ re: RegExp }>().onAs<Obj.NoExcess<{ re: RegExp }, { re: RegExp }>>()

// NoExcessNonEmpty
A.exact.ofAs<a>().onAs<Obj.NoExcessNonEmpty<a, a>>()
// TODO
// A.exact.never.onAs<Obj.NoExcessNonEmpty<{}, a>>()
A.exact.ofAs<{ name: string; age: number; extra: never }>().onAs<Obj.NoExcessNonEmpty<b, a>>()
