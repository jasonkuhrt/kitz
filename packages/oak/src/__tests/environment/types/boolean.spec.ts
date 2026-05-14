import { expect, test } from 'bun:test'
import { $, b } from '../../_/helpers.js'

test.each([
  [`true`, { foo: true }],
  [`false`, { foo: false }],
  [`1`, { foo: true }],
  [`0`, { foo: false }],
])(`%s`, (value, expected) => {
  expect(
    $.parameter(`foo`, b).parse({ line: [], environment: { cli_param_foo: value } }),
  ).toMatchObject(expected)
})
