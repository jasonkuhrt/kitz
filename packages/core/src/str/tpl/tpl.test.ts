import { Test } from '#kitz/test'
import * as Tpl from './tpl.js'

const getTpl = (...args: Tpl.CallInput) => args[0]
const getCallInput = (...args: Tpl.CallInput) => args

Test.on(Tpl.is)
  .cases(
    // True cases
    [[getTpl`hello`], true],
    [[getTpl`hello ${'x'}`], true],
    // False cases
    [[[]], false],
    [[[`a`, `b`] as any], false],
    [[{ raw: [`test`] }], false],
    [[null], false],
    [[42], false],
  )
  .test()

Test.on(Tpl.isCallInput)
  .cases(
    // True cases
    [[getCallInput`test`], true],
    [[getCallInput`hello ${1}`], true],
    // False cases
    [[null], false],
    [[[]], false],
    [[[[`not`, `template`]]], false],
  )
  .test()

// dprint-ignore
Test.describe(`passthrough`)
  .inputType<string>()
  .outputType<string>()
  .cases(
    [Tpl.passthrough`Hello ${`World`}!`,                                `Hello World!`],
    [Tpl.passthrough`Sum: ${1} + ${2} = ${3}`,                          `Sum: 1 + 2 = 3`],
    [Tpl.passthrough`\n      export const foo = ${42}\n    `,           `\n      export const foo = 42\n    `],
  )
  .test()

Test.describe(`dedent`)
  .inputType<string>()
  .outputType<string>()
  .cases(
    // Remove common indentation, preserve relative indentation
    [
      Tpl.dedent`
      line 1
      line 2
        indented
    `,
      `line 1\nline 2\n  indented`,
    ],
    // Trim leading/trailing blank lines
    [
      Tpl.dedent`

      content

    `,
      `content`,
    ],
    // Single-line interpolation
    [
      Tpl.dedent`
      Hello ${`world`}
      How are you?
    `,
      `Hello world\nHow are you?`,
    ],
    // Multi-line value auto-indentation (key feature for dindist #9)
    [
      Tpl.dedent`
      outer:
        ${`line1\nline2\nline3`}
    `,
      `outer:\n  line1\n  line2\n  line3`,
    ],
    // Preserve internal blank lines
    [
      Tpl.dedent`
      line 1

      line 3
    `,
      `line 1\n\nline 3`,
    ],
    // Edge case: empty
    [Tpl.dedent``, ``],
  )
  .test()

Test.describe(`highlight`)
  .inputType<string>()
  .outputType<string>()
  .cases(
    // Simple single-line cases (no dedenting needed)
    [Tpl.highlight.ts`const x = ${100}`, `const x = 100`],
    [Tpl.highlight.html`test`, `test`],
    [Tpl.highlight.sql`test`, `test`],
    // Multi-line cases with dedenting
    [
      Tpl.highlight.ts`
      export const add = (a: number, b: number) => {
        return a + b
      }
    `,
      `export const add = (a: number, b: number) => {\n  return a + b\n}`,
    ],
    [
      Tpl.highlight.html`
      <div class="container">
        <h1>Title</h1>
      </div>
    `,
      `<div class="container">\n  <h1>Title</h1>\n</div>`,
    ],
    [
      Tpl.highlight.sql`
      SELECT id, name
      FROM users
      WHERE status = 'active'
    `,
      `SELECT id, name\nFROM users\nWHERE status = 'active'`,
    ],
    // Multi-line with interpolation
    [
      Tpl.highlight.graphql`
      query GetUser($id: ID!) {
        user(id: $id) {
          name
          email
        }
      }
    `,
      `query GetUser($id: ID!) {\n  user(id: $id) {\n    name\n    email\n  }\n}`,
    ],
  )
  .test()

// Regression test for dindist issue #9: nested dedent calls with function interpolation
// This validates that multi-line interpolated values get auto-indented to match context
// https://github.com/jasonkuhrt-archive/dindist/issues/9
Test.describe(`dedent nested calls`)
  .inputType<string>()
  .outputType<string>()
  .cases(
    [
      (() => {
        const intro = () =>
          Tpl.dedent`
        * intro line
      `
        const body = Tpl.dedent`
        * body line 1
        * body line 2
      `
        const outro = () =>
          Tpl.dedent`
        * outro line
      `

        return Tpl.dedent`
        /**
         ${intro()}
          *
          ${body}
          *
          ${outro()}
          */
      `
      })(),
      `/**
 * intro line
 *
 * body line 1
 * body line 2
 *
 * outro line
 */`,
    ],
  )
  .test()
