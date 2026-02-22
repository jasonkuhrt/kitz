import { Type as A } from '#kitz/assert/assert'
import { Pat } from '#pat'

A.parameter1.sub.ofAs<Pat.Pattern<number>>().on(Pat.isMatchOn(42))
A.parameter1.sub.ofAs<Pat.Pattern<string>>().on(Pat.isMatchOn('hello'))
A.parameter1.sub.ofAs<Pat.Pattern<boolean>>().on(Pat.isMatchOn(true))
A.parameter1.sub.ofAs<Pat.Pattern<bigint>>().on(Pat.isMatchOn(1n))
A.parameter1.sub.ofAs<Pat.Pattern<Date>>().on(Pat.isMatchOn(new Date()))
A.parameter1.sub.ofAs<Pat.Pattern<number[]>>().on(Pat.isMatchOn([1, 2]))
A.parameter1.sub.ofAs<Pat.Pattern<{ name: string; age: number }>>().on(
  Pat.isMatchOn({ name: 'Alice', age: 30 }),
)
