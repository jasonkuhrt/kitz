import { Test } from '#kitz/test'
import { Str } from './_.js'

Test.on(Str.Visual.Table.render)
  .casesInput(
    // Basic render
    [[['Name', 'Age'], ['Alice', '30']], undefined],
    // Custom separator
    [[['a', 'b'], ['c', 'd']], { separator: ' | ' }],
    // Right align
    [[['hi', 'world'], ['hello', 'x']], { align: 'right' }],
    // ANSI codes (visual width)
    [[['\x1b[31mRed\x1b[0m', 'Normal'], ['Text', 'More']], undefined],
    // Jagged array (missing cells)
    [[['a', 'b', 'c'], ['d']], undefined],
    // Empty table
    [[], undefined],
  )
  .test()

Test.on(Str.Visual.Table.renderColumns)
  .casesInput(
    // Basic column rendering
    [[['Name', 'Alice'], ['Age', '30']], undefined],
    // Custom separator
    [[['a', 'c'], ['b', 'd']], { separator: ' | ' }],
    // Jagged columns
    [[['A', 'B'], ['X', 'Y', 'Z']], undefined],
    // Empty columns
    [[], undefined],
  )
  .test()

Test.on(Str.Visual.Table.columnWidths)
  .casesInput(
    // Basic
    [[['hi', 'world'], ['hello', 'x']]],
    // ANSI codes (visual width ignores escape codes) - "Red" is 3, "Text" is 4, max is 4
    [[['\x1b[31mRed\x1b[0m', 'Normal'], ['Text', 'Longer']]],
    // Jagged
    [[['a'], ['bb', 'c']]],
    // Empty
    [[]],
  )
  .test()

Test.on(Str.Visual.Table.dimensions)
  .casesInput(
    [[['a', 'b'], ['c', 'd']]],
    [[['a'], ['b', 'c']]],
    [[]],
  )
  .test()

Test.on(Str.Visual.Table.normalize)
  .casesInput(
    // Jagged → rectangular
    [[['a', 'b'], ['c']]],
    // Already rectangular
    [[['a', 'b'], ['c', 'd']]],
    // Empty
    [[]],
  )
  .test()
