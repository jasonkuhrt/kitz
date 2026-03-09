/**
 * Terminal Text Layout Engine
 *
 * Build rich CLI text layouts with a chainable API. Create bordered blocks, tables,
 * and lists with automatic width calculation, padding, and visual alignment.
 *
 * @category CLI/Text Rendering
 *
 * @example
 * ```typescript
 * import { Tex } from '@wollybeard/kit'
 *
 * // Simple text block
 * const output = Tex.Tex()
 *   .text('Hello World')
 *   .render()
 *
 * // Bordered block with padding
 * Tex.Tex()
 *   .block({
 *     border: { top: '-', bottom: '-', left: '|', right: '|' },
 *     padding: { left: 2, right: 2 }
 *   }, 'Important Message')
 *   .render()
 *
 * // Table with headers
 * Tex.Tex()
 *   .table(($) => $
 *     .headers(['Name', 'Age', 'City'])
 *     .row('Alice', '30', 'NYC')
 *     .row('Bob', '25', 'LA')
 *   )
 *   .render()
 *
 * // Nested blocks
 * Tex.Tex()
 *   .block(($) => $
 *     .text('Parent Block')
 *     .block({ padding: { left: 2 } }, 'Nested Block')
 *   )
 *   .render()
 * ```
 */

export type { BlockBuilder } from './chain/block.js'
export { block } from './chain/block.js'
export type { Builder } from './chain/helpers.js'
export type { RootBuilder } from './chain/root.js'

/**
 * Create a root text layout builder.
 *
 * @category CLI/Text Rendering
 * @param parameters - Optional block parameters for the root container, including terminalWidth
 * @returns A root builder with chainable methods and `.render()` to generate output
 *
 * @example
 * ```typescript
 * // Start building and render
 * const output = Tex.Tex()
 *   .text('Hello')
 *   .text('World')
 *   .render()
 *
 * // With explicit terminal width (useful for testing or fixed-width output)
 * Tex.Tex({ terminalWidth: 80 })
 *   .text('Content')
 *   .render()
 *
 * // With other root-level configuration
 * Tex.Tex({ terminalWidth: 120, padding: { left: 2 } })
 *   .text('Content')
 *   .render()
 * ```
 */
export { createRootBuilder as Tex } from './chain/root.js'

/**
 * Render a builder to a string without calling `.render()` on the builder itself.
 * Useful for rendering builders created in utility functions.
 *
 * @category CLI/Text Rendering
 * @param builder - Any tex builder (root, block, table, or list)
 * @returns The rendered text output
 *
 * @example
 * ```typescript
 * const builder = Tex.Tex().text('Hello')
 * const output = Tex.render(builder)
 * // Same as: builder.render()
 * ```
 */
export { render } from './chain/root.js'

export type { TableBuilder } from './chain/table.js'
export type { BlockParameters } from './nodes/block.js'

/**
 * Block node class. Can be used to create blocks directly instead of via builder methods.
 *
 * @category CLI/Text Rendering
 *
 * @example
 * ```typescript
 * // Usually you use the builder API:
 * Tex.Tex().block('content')
 *
 * // But you can create blocks directly:
 * const myBlock = new Tex.Block({ border: { top: '-' } }, 'content')
 * Tex.Tex().block(myBlock).render()
 * ```
 */
export { Block } from './nodes/block.js'

/**
 * Box layout model for terminal text rendering.
 *
 * Provides a CSS-like box model for building terminal UIs with padding, margin,
 * borders, and content. Supports both mutable and immutable APIs.
 *
 * @category Text Formatting
 */
export { Box } from './box/_.js'

/**
 * Terminal glyph library.
 *
 * Organized collection of Unicode characters for terminal UIs:
 * - `Glyph.box` - Box drawing characters (edges, corners, connectors)
 * - `Glyph.status` - Status indicators (check, cross, circles)
 * - `Glyph.arrow` - Arrow characters
 *
 * @category Text Formatting
 *
 * @example
 * ```typescript
 * import { Tex } from '@kitz/tex'
 *
 * // Box drawing
 * const border = `${Tex.Glyph.box.corner.topLeft}${Tex.Glyph.box.edge.horizontal}`
 *
 * // Status symbols
 * const done = Tex.Glyph.status.check  // ✓
 * const fail = Tex.Glyph.status.cross  // ✗
 *
 * // Arrows
 * const next = Tex.Glyph.arrow.right   // →
 * ```
 */
export { Glyph } from './glyph/_.js'
