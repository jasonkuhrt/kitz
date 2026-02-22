import type { Type as A } from '#kitz/assert/assert'
import { Pat } from '#pat'
import { Ts } from '#ts'
import * as S from 'effect/Schema'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Basic Types
//

// String patterns - test valid assignments
type StringPat = Pat.PatternForType<string>
const _stringLiteral: StringPat = 'hello'
const _stringRegex: StringPat = /^test/
const _stringConstraint: StringPat = { $length: 5 }
const _stringConstraint2: StringPat = { $format: /^[a-z]+$/ }
const _stringSchema: StringPat = S.String

// Number patterns - test valid assignments
type NumberPat = Pat.PatternForType<number>
const _numberLiteral: NumberPat = 42
const _numberConstraint: NumberPat = { $gt: 0 }
const _numberConstraint2: NumberPat = { $gte: 0, $lte: 100 }
const _numberSchema: NumberPat = S.Number

// Boolean patterns - test valid assignments
type BooleanPat = Pat.PatternForType<boolean>
const _booleanLiteral: BooleanPat = true
const _booleanSchema: BooleanPat = S.Boolean

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Object Patterns
//

type User = { name: string; age: number; active: boolean }
type UserPattern = Pat.PatternForType<User>

// Valid patterns should be assignable
const _validUserPattern1: UserPattern = { name: 'Alice' }
const _validUserPattern2: UserPattern = { name: /^A/ }
const _validUserPattern3: UserPattern = { age: { $gte: 18 } }
const _validUserPattern4: UserPattern = { name: /^A/, age: { $gte: 18 } }
const _validUserPattern5: UserPattern = { active: true }
const _validUserPattern6: UserPattern = {} // empty (partial matching)

// Invalid key should fail
// @ts-expect-error - invalid key
const _invalidUserPattern: UserPattern = { invalid: 'test' }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Array Patterns
//

type Numbers = number[]
type NumbersPattern = Pat.PatternForType<Numbers>

// Valid patterns
const _validArrayPattern1: NumbersPattern = { $every: { $gt: 0 } }
const _validArrayPattern2: NumbersPattern = { $some: { $lt: 10 } }
const _validArrayPattern3: NumbersPattern = { $length: 5 }
const _validArrayPattern4: NumbersPattern = [1, 2, 3] // tuple

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Nested Patterns
//

type Nested = {
  user: {
    name: string
    age: number
  }
  items: Array<{ id: number; name: string }>
}
type NestedPattern = Pat.PatternForType<Nested>

// Valid nested pattern
const _validNestedPattern: NestedPattern = {
  user: {
    name: /^J/,
    age: { $gte: 18 },
  },
  items: {
    $every: {
      id: { $gt: 0 },
      name: S.String,
    },
  },
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Combinators
//

type Value = string | number
type ValuePattern = Pat.PatternForType<Value>

// Combinators always allowed
const _combinator1: ValuePattern = { $not: S.String }
const _combinator2: ValuePattern = { $or: [S.String, S.Number] }
const _combinator3: ValuePattern = { $and: [{ $gt: 0 }, { $lt: 100 }] }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • PatternForSchema
//

const UserSchema = S.Struct({
  name: S.String,
  age: S.Number,
})

type UserSchemaPattern = Pat.PatternForSchema<typeof UserSchema>

// Valid patterns
const _validSchemaPattern1: UserSchemaPattern = { name: 'Alice' }
const _validSchemaPattern2: UserSchemaPattern = { name: /^A/, age: { $gte: 18 } }
const _validSchemaPattern3: UserSchemaPattern = {}

// Invalid key should fail
// @ts-expect-error - invalid key
const _invalidSchemaPattern: UserSchemaPattern = { invalid: 'test' }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • PatternForV1Schema
//

// Simulate Zod schema structure
type ZodSchema = {
  _output: {
    name: string
    age: number
  }
}

const zodSchema: ZodSchema = null as any

type ZodPattern = Pat.PatternForV1Schema<typeof zodSchema>

// Valid patterns
const _validV1Pattern1: ZodPattern = { name: 'Alice' }
const _validV1Pattern2: ZodPattern = { age: { $gte: 18 } }

// Invalid key should fail
// @ts-expect-error - invalid key
const _invalidV1Pattern: ZodPattern = { invalid: 'test' }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Runtime Factories
//

const _user = { name: 'Alice', age: 30 }
const _patternFromValue = Pat.patternFor(_user)

// dprint-ignore
type _PatternForValueTest = A.Cases<
  A.exact.of<typeof _patternFromValue, Pat.PatternForValue<typeof _user>>
>

const _patternFromSchema = Pat.patternForSchema(UserSchema)

// dprint-ignore
type _PatternForSchemaTest = A.Cases<
  A.exact.of<typeof _patternFromSchema, Pat.PatternForSchema<typeof UserSchema>>
>

const _patternFromV1Schema = Pat.patternForV1Schema(zodSchema)

// dprint-ignore
type _PatternForV1SchemaTest = A.Cases<
  A.exact.of<typeof _patternFromV1Schema, Pat.PatternForV1Schema<typeof zodSchema>>
>
