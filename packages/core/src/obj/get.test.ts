import { Type as A } from '#kitz/assert/assert'
import { Obj } from '#obj'
import { describe, test } from 'vitest'

describe('Obj.entries', () => {
  describe('type-level behavior', () => {
    test('optional key has undefined removed from value type', () => {
      type OptionalKeyObj = { name?: string }
      type Entries = Obj.entries<OptionalKeyObj>

      // Optional key should not include undefined in value type
      A.sub.ofAs<['name', string][]>().onAs<Entries>()
    })

    test('required key with undefined preserves undefined in value type', () => {
      type RequiredUndefinedObj = { name: string | undefined }
      type Entries = Obj.entries<RequiredUndefinedObj>

      // Required key with undefined should preserve undefined in value type
      A.sub.ofAs<['name', string | undefined][]>().onAs<Entries>()
    })

    test('mixed optional and required keys with complex types', () => {
      type MixedObj = {
        name?: string
        age: number | undefined
        city: string
        hobbies?: string[]
      }

      type Entries = Obj.entries<MixedObj>

      // Should be union of all possible entry types
      type ExpectedEntries = (
        | [string, string] // name (optional, no undefined)
        | [string, number | undefined] // age (required, undefined preserved)
        | [string, string] // city (required, no undefined)
        | [string, string[]] // hobbies (optional, no undefined)
      )[]

      A.sub.ofAs<ExpectedEntries>().onAs<Entries>()
    })

    test('object with only optional keys', () => {
      type AllOptionalObj = {
        name?: string
        age?: number
        city?: string
      }

      type Entries = Obj.entries<AllOptionalObj>

      // All values should not include undefined since keys are optional
      type ExpectedEntries = (
        | [string, string] // name
        | [string, number] // age
        | [string, string] // city
      )[]

      A.sub.ofAs<ExpectedEntries>().onAs<Entries>()
    })

    test('object with only required keys having undefined', () => {
      type AllRequiredUndefinedObj = {
        name: string | undefined
        age: number | undefined
      }

      type Entries = Obj.entries<AllRequiredUndefinedObj>

      // All values should preserve undefined since keys are required
      type ExpectedEntries = (
        | [string, string | undefined]
        | [string, number | undefined]
      )[]

      A.sub.ofAs<ExpectedEntries>().onAs<Entries>()
    })

    test('nested object structures', () => {
      type NestedObj = {
        user?: { name: string; age?: number }
        metadata: { created: Date | undefined }
      }

      type Entries = Obj.entries<NestedObj>

      type ExpectedEntries = (
        | [string, { name: string; age?: number }] // user (optional key, no undefined)
        | [string, { created: Date | undefined }] // metadata (required key, preserve type)
      )[]

      A.sub.ofAs<ExpectedEntries>().onAs<Entries>()
    })

    test('complex value types with optional vs required distinction', () => {
      type ComplexObj = {
        requiredArray: string[] | undefined
        optionalArray?: string[]
        requiredObject: { x: number } | undefined
        optionalObject?: { x: number }
        requiredFunction: (() => void) | undefined
        optionalFunction?: () => void
      }

      type Entries = Obj.entries<ComplexObj>

      type ExpectedEntries = (
        | [string, string[] | undefined] // requiredArray (required, undefined preserved)
        | [string, string[]] // optionalArray (optional, undefined removed)
        | [string, { x: number } | undefined] // requiredObject (required, undefined preserved)
        | [string, { x: number }] // optionalObject (optional, undefined removed)
        | [string, (() => void) | undefined] // requiredFunction (required, undefined preserved)
        | [string, () => void] // optionalFunction (optional, undefined removed)
      )[]

      A.sub.ofAs<ExpectedEntries>().onAs<Entries>()
    })

    test('empty object', () => {
      type EmptyObj = {}
      type Entries = Obj.entries<EmptyObj>

      A.sub.ofAs<never[]>().onAs<Entries>()
    })

    test('object with readonly properties', () => {
      type ReadonlyObj = {
        readonly name?: string
        readonly age: number | undefined
      }

      type Entries = Obj.entries<ReadonlyObj>

      type ExpectedEntries = (
        | [string, string] // name (optional, undefined removed)
        | [string, number | undefined] // age (required, undefined preserved)
      )[]

      A.sub.ofAs<ExpectedEntries>().onAs<Entries>()
    })

    test('fixed: ExcludeUndefined preserves null for optional keys', () => {
      type OptionalWithNull = {
        value?: string | null
      }

      type Entries = Obj.entries<OptionalWithNull>

      // FIXED: Now using ExcludeUndefined instead of NonNullable
      // ExcludeUndefined<string | null | undefined> = string | null (correct)
      // NonNullable<string | null | undefined> = string (incorrect)

      // This should now correctly preserve null for optional keys
      A.sub.ofAs<['value', string | null][]>().onAs<Entries>()
    })

    test('required key with null should preserve null', () => {
      type RequiredWithNull = {
        value: string | null
      }

      type Entries = Obj.entries<RequiredWithNull>

      // Required keys should preserve null correctly
      A.sub.ofAs<['value', string | null][]>().onAs<Entries>()
    })

    test('demonstrate correct behavior: only undefined removed from optional keys', () => {
      type TestCases = {
        optionalWithNull?: string | null
        optionalWithUndefined?: string | undefined
        optionalWithBoth?: string | null | undefined
        requiredWithNull: string | null
        requiredWithUndefined: string | undefined
        requiredWithBoth: string | null | undefined
      }

      type Entries = Obj.entries<TestCases>

      // Optional keys should remove undefined but preserve null
      type ExpectedEntries = (
        | ['optionalWithNull', string | null] // null preserved
        | ['optionalWithUndefined', string] // undefined removed
        | ['optionalWithBoth', string | null] // undefined removed, null preserved
        | ['requiredWithNull', string | null] // null preserved
        | ['requiredWithUndefined', string | undefined] // undefined preserved
        | ['requiredWithBoth', string | null | undefined] // both preserved
      )[]

      A.sub.ofAs<ExpectedEntries>().onAs<Entries>()
    })
  })
})
