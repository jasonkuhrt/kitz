import { describe, expect, expectTypeOf, it } from '@kitz/vitest'
import * as Path from '@kitz/effect/Path'
import * as Schema from '@kitz/effect/Schema'
import * as String from '@kitz/effect/String'
import * as Tuple from '@kitz/effect/Tuple'
import * as Types from '@kitz/effect/Types'

describe('package subpaths', () => {
  it('expose each module directly without a duplicate namespace wrapper', () => {
    // @ts-expect-error RED-PIN: Path subpath currently exposes Path.make
    expect(Path.make('/tmp/')).toEncodeTo('/tmp/')
    // @ts-expect-error RED-PIN: Schema subpath currently exposes Schema.decodeSync
    expect(Schema.decodeSync(Schema.NaturalInt)(0)).toBe(0)
    // @ts-expect-error RED-PIN: String subpath currently exposes String.camelCase
    expect(String.camelCase('hello-world')).toBe('helloWorld')
    // @ts-expect-error RED-PIN: Tuple subpath currently exposes Tuple.Last
    expectTypeOf<Tuple.Last<readonly [1, 2]>>().toEqualTypeOf<2>()
    // @ts-expect-error RED-PIN: Types subpath currently exposes Types.IsLiteral
    expectTypeOf<Types.IsLiteral<'literal'>>().toEqualTypeOf<true>()
  })
})
