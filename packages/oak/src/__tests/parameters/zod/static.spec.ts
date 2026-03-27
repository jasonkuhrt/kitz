import { Assert } from '@kitz/assert'
import { expect, it } from 'vitest'
import * as z from 'zod/v4'
import { $ } from '../../_/helpers.js'

it(`Statically accepts or rejects zod types for the schema`, () => {
  // union
  Assert.equiv
    .ofAs<() => { a: number | 'a' | 'b' }>()
    .on($.parameter(`a`, z.union([z.number(), z.nativeEnum({ a: `a`, b: `b` } as const)])).parse)
  Assert.equiv
    .ofAs<() => { a: 1 | 'a' | true | false }>()
    .on(
      $.parameter(`a`, z.union([z.literal(1), z.literal(`a`), z.literal(true), z.literal(false)]))
        .parse,
    )
  // todo key should be ?
  // optional
  // default

  // Note: z.unknown() is correctly rejected at compile time by TypeScript
  // The Zod extension's SupportedZodType union excludes ZodUnknown
})
