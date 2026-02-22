import { Test } from '#kitz/test'
import { describe, expect } from 'vitest'
import { lines, normalizeLineEndings, stripIndent } from './text.js'

describe('stripIndent', () => {
  // dprint-ignore
  Test.describe('basic dedenting')
    .on(stripIndent)
    .cases(
      [['    line1\n    line2\n    line3'],                           'line1\nline2\nline3'],
      [['    line1\n      line2\n    line3'],                         'line1\n  line2\nline3'],
      [['line1\nline2\nline3'],                                       'line1\nline2\nline3'],
      [['    single'],                                                'single'],
      [['single'],                                                    'single'],
    )
    .test()

  // dprint-ignore
  Test.describe('empty lines')
    .on(stripIndent)
    .cases(
      [['    line1\n\n    line2'],                                    'line1\n\nline2'],
      [['\n    line1\n    line2'],                                    '\nline1\nline2'],
      [['    line1\n    line2\n'],                                    'line1\nline2\n'],
      [['\n\n\n'],                                                     '\n\n\n'],
      [[''],                                                          ''],
    )
    .test()

  // dprint-ignore
  Test.describe('edge cases')
    .on(stripIndent)
    .cases(
      [['    line1\n\t\tline2'],                                      '  line1\nline2'],
      [['no-indent\n    line2'],                                      'no-indent\n    line2'],
      [['    line1\n    \n    line2'],                                'line1\n\nline2'],
    )
    .test()

  // dprint-ignore
  Test.describe('code block example')
    .on(stripIndent)
    .cases(
      [[
        '    d.resolve(1);\n' +
        '      nested();\n' +
        '    d.resolve(2);'
      ], 'd.resolve(1);\n  nested();\nd.resolve(2);'],
    )
    .test(({ result, output }) => {
      expect(result).toBe(output)
    })
})

// ─── Line Endings ────────────────────────────────────────────────────────────

// dprint-ignore
Test.describe('lines > cross-platform')
  .on(lines)
  .cases(
    [['a\nb\nc'],       ['a', 'b', 'c']],       // LF (Unix)
    [['a\r\nb\r\nc'],   ['a', 'b', 'c']],       // CRLF (Windows)
    [['a\rb\rc'],       ['a', 'b', 'c']],       // CR (Classic Mac)
    [['a\r\nb\nc\rd'],  ['a', 'b', 'c', 'd']],  // Mixed
    [['single'],        ['single']],
    [[''],              ['']],
  )
  .test()

// dprint-ignore
Test.describe('normalizeLineEndings')
  .on(normalizeLineEndings)
  .cases(
    [['a\r\nb'],    'a\nb'],       // CRLF → LF
    [['a\rb'],      'a\nb'],       // CR → LF
    [['a\nb'],      'a\nb'],       // LF unchanged
    [['a\r\nb\rc'], 'a\nb\nc'],    // Mixed
    [['no-nl'],     'no-nl'],      // No line endings
  )
  .test()
