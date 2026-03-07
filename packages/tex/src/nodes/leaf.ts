import { Str } from '@kitz/core'
import { MAX_COLUMN_WIDTH, type RenderContext } from './helpers.js'
import { Node } from './node.js'

export class Leaf extends Node {
  value: string
  constructor(value: string) {
    super()
    this.value = value
  }
  render(context: RenderContext) {
    // Apply column readability cap - text columns should never exceed MAX_COLUMN_WIDTH
    const effectiveMaxWidth = Math.min(context.maxWidth ?? MAX_COLUMN_WIDTH, MAX_COLUMN_WIDTH)
    const lines = Str.Visual.wrap(this.value, effectiveMaxWidth, {
      strategy: 'break-word-hyphen-in',
    })
    const value = lines.join(Str.Char.newline)
    const intrinsicWidth = Math.max(...lines.map((_) => Str.Visual.width(_)))
    const intrinsicHeight = lines.length
    return {
      shape: {
        intrinsicWidth,
        intrinsicHeight,
        desiredWidth: null,
      },
      value,
    }
  }
}
