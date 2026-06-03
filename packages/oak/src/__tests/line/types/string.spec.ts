import { Assert } from '@kitz/assert'
import { describe, expect, it } from 'bun:test'
import { $, n, s } from '../../_/helpers.js'

describe(`errors`, () => {
  it.each([
    [`when argument missing (last position)`, { name: s }, { line: [`--name`] }],
    [
      `when argument missing (non-last position)`,
      { name: s, age: n },
      { line: [`--name`, `--age`, `1`] },
    ],
    [`when flag passed twice`, { '--name': s }, { line: [`--name`, `1`, `--name`, `1`] }],
    [`when long and short flag passed `, { '--name -n': s }, { line: [`--name`, `1`, `-n`, `1`] }],
  ])(`%s`, (_, parameters, input) => {
    expect(() => {
      Object.entries(parameters)
        .reduce((chain, data) => chain.parameter(data[0] as any, data[1]), $)
        .settings({ onError: `throw`, helpOnError: false })
        .parse(input)
    }).toThrowErrorMatchingSnapshot()
  })
})

describe(`optional`, () => {
  // TODO(#220): pre-existing shared-state test pollution. Passes in isolation but
  // fails in the full suite under Linux test-file ordering: a prior test leaks
  // state so an omitted optional is parsed as supplied/undefined and the key
  // appears. Re-enable once the cross-test mutable state is isolated. See #220.
  it.skip(`specified input can be omitted, missing key is possible`, () => {
    const args = $.parameter(`--foo`, s.optional()).parse({ line: [] })
    Assert.on(args).exact.of({} as { foo: string | undefined })
    expect(Object.keys(args)).not.toContain(`foo`)
  })
  it(`input can be given`, () => {
    const args = $.parameter(`--foo`, s.optional()).parse({ line: [`--foo`, `bar`] })
    Assert.on(args).exact.of({} as { foo: string | undefined })
    expect(args).toMatchObject({ foo: `bar` })
  })
})

it(`is not trimmed by default`, () => {
  expect($.parameter(`name`, s).parse({ line: [`--name`, `foobar  `] })).toMatchSnapshot()
})
