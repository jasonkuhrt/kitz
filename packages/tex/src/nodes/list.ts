import { Arr, Str } from '@kitz/core'
import type { BlockParameters } from './block.js'
import { Block } from './block.js'
import type { RenderContext } from './helpers.js'
import { Leaf } from './leaf.js'
import { Node } from './node.js'

export interface ListParameters {
  /**
   * Space between list items (container property).
   * - `number` - Newlines between items in vertical orientation
   *
   * @example
   * ```typescript
   * gap: 1  // One blank line between items
   * ```
   */
  gap?: number
  bullet?: {
    graphic?: string | ((index: number) => string)
    align?: {
      horizontal?: 'left' | 'right'
    }
  }
}

export class List extends Node {
  items: Block[]
  parameters: ListParameters
  constructor(items?: (string | Block | null)[]) {
    const items_ = items?.map((_) => (typeof _ === `string` ? new Block(new Leaf(_)) : _)) ?? []
    super()
    this.items = items_.filter((_): _ is Block => _ !== null)
    this.parameters = {}
  }
  setParameters(parameters: ListParameters) {
    this.parameters = parameters
    return this
  }
  render(context: RenderContext) {
    const bullet = {
      graphic: this.parameters.bullet?.graphic ?? `*`,
      align: {
        horizontal: this.parameters.bullet?.align?.horizontal ?? `left`,
      },
    }
    const bullets = ` `
      .repeat(this.items.length)
      .split(` `)
      .map((_, index) =>
        typeof bullet.graphic === `function` ? bullet.graphic(index) : bullet.graphic,
      )
    const gutterWidth = Math.max(...bullets.map((_) => Str.Visual.width(_)))
    const gutterWidthWithSpacing = gutterWidth + 1
    const context_ = {
      ...context,
      maxWidth: (context.maxWidth ?? 1000) - gutterWidthWithSpacing,
    }
    const items = this.items.map((item) => item.render(context_).value)

    // Apply gap between items
    const gap = this.parameters.gap ?? 0
    const separator = Str.Char.newline.repeat(1 + gap)

    let value = items
      .map((_, index) => {
        // Manually align bullet within gutter width
        const alignedBullet = Str.Visual.span(bullets[index]!, gutterWidth, bullet.align.horizontal)
        const contentLines = Str.Text.lines(_)
        // Create bullet column with empty strings for continuation lines
        const bulletColumn = [alignedBullet, ...Array(contentLines.length - 1).fill('')]
        return Str.Visual.Table.render(Arr.transpose([bulletColumn, contentLines]), {
          separator: ` `,
          align: 'left',
        })
      })
      .join(separator)

    const lines = items.flatMap(Str.Text.lines)
    const intrinsicWidth = Math.max(...lines.map((_) => Str.Visual.width(_)))
    const intrinsicHeight = Str.Text.lines(value).length
    return {
      shape: {
        intrinsicWidth,
        intrinsicHeight,
        desiredWidth: null,
      },
      value: value,
    }
  }
}
