import { Str } from '@kitz/core'

export const renderTableText = (table: string[][]): string => {
  return Str.Text.unlines(
    Str.Text.lines(Str.Visual.Table.render(table)).map((line) => line.trimEnd()),
  )
}
