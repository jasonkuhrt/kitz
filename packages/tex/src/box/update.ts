import { type BorderInput, Box, type MarginInput, type PaddingInput } from './box.js'
import type * as PropGap from './properties/gap.js'
import type { SpanRange } from './properties/span-range.js'
import type * as PropSpan from './properties/span.js'

/**
 * Change the content of a box (returns new Box).
 *
 * **Immutable**: This method returns a new Box instance.
 *
 * @param box - The box to modify
 * @param content - New content for the box (string or array of strings/boxes)
 * @returns A new Box with the updated content
 *
 * @example
 * ```typescript
 * const box = new Box({ content: 'Hello' })
 * const box2 = content(box, 'Goodbye')
 * // box is unchanged, box2 has new content
 *
 * // Use nested boxes
 * const box3 = content(box, [
 *   'Header',
 *   new Box({ content: 'Body' }).pad$([1, 2]),
 *   'Footer'
 * ])
 * ```
 */
export const content = (box: Box, newContent: string | Array<string | Box>): Box => {
  const newBox = box.clone()
  newBox.content$(newContent)
  return newBox
}

/**
 * Add padding to a box (returns new Box).
 *
 * **Immutable**: This method returns a new Box instance.
 *
 * Accepts CSS clockhand notation and hooks (same as pad$).
 *
 * @param box - The box to modify
 * @param padding - Padding configuration
 * @returns A new Box with the padding applied
 *
 * @example
 * ```typescript
 * const box = new Box({ content: 'Hello' })
 * const padded = pad(box, [2, 4])
 * // box is unchanged, padded has padding
 * ```
 */
export const pad = (box: Box, padding: PaddingInput): Box => {
  const newBox = box.clone()
  newBox.pad$(padding)
  return newBox
}

/**
 * Add margin to a box (returns new Box).
 *
 * **Immutable**: This method returns a new Box instance.
 *
 * Accepts CSS clockhand notation and hooks (same as margin$).
 *
 * @param box - The box to modify
 * @param marginInput - Margin configuration
 * @returns A new Box with the margin applied
 *
 * @example
 * ```typescript
 * const box = new Box({ content: 'Hello' })
 * const margined = margin(box, [2, 4])
 * // box is unchanged, margined has margin
 * ```
 */
export const margin = (box: Box, marginInput: MarginInput): Box => {
  const newBox = box.clone()
  newBox.margin$(marginInput)
  return newBox
}

/**
 * Add a border to a box (returns new Box).
 *
 * **Immutable**: This method returns a new Box instance.
 *
 * @param box - The box to modify
 * @param borderInput - Border configuration
 * @returns A new Box with the border applied
 *
 * @example
 * ```typescript
 * const box = new Box({ content: 'Hello' })
 * const bordered = border(box, { style: 'single' })
 * // box is unchanged, bordered has border
 * ```
 */
export const border = (box: Box, borderInput: BorderInput): Box => {
  const newBox = box.clone()
  newBox.border$(borderInput)
  return newBox
}

/**
 * Set box span (exact/desired size) (returns new Box).
 *
 * **Immutable**: This method returns a new Box instance.
 *
 * Accepts AxisProperty notation with bigint support for percentages:
 * - `span(box, 80)` - 80 chars on both axes
 * - `span(box, 50n)` - 50% of parent on both axes
 * - `span(box, [50n, 80])` - main: 50% of parent, cross: 80 chars
 * - `span(box, { main: 100, cross: 50n })` - main: 100 chars, cross: 50%
 *
 * @param box - The box to modify
 * @param spanInput - Span configuration (number = chars, bigint = percentage)
 * @returns A new Box with the span applied
 *
 * @example
 * ```typescript
 * const box = new Box({ content: 'Hello' })
 * const sized = span(box, [50n, 80])  // main: 50% of parent, cross: 80 chars
 * // box is unchanged, sized has span
 * ```
 */
export const span = (box: Box, spanInput: PropSpan.Input): Box => {
  const newBox = box.clone()
  newBox.span$(spanInput)
  return newBox
}

/**
 * Set box span range constraints (min/max) (returns new Box).
 *
 * **Immutable**: This method returns a new Box instance.
 *
 * @param box - The box to modify
 * @param spanRangeInput - Span range constraints per axis
 * @returns A new Box with the span range applied
 *
 * @example
 * ```typescript
 * const box = new Box({ content: 'Hello' })
 * const constrained = spanRange(box, { main: { max: 10 }, cross: { min: 5, max: 20 } })
 * // box is unchanged, constrained has span range
 * ```
 */
export const spanRange = (box: Box, spanRangeInput: SpanRange): Box => {
  const newBox = box.clone()
  newBox.spanRange$(spanRangeInput)
  return newBox
}

/**
 * Set gap between array items (returns new Box).
 *
 * **Immutable**: This method returns a new Box instance.
 *
 * Gap is space between items in array content:
 * - Vertical: main=newlines, cross=spaces
 * - Horizontal: main=spaces, cross=newlines
 *
 * @param box - The box to modify
 * @param gapInput - Gap configuration (number or object)
 * @returns A new Box with the gap applied
 *
 * @example
 * ```typescript
 * const box = new Box({ content: ['Item 1', 'Item 2', 'Item 3'] })
 * const spaced = gap(box, 2)  // 2 newlines between items (vertical)
 * // box is unchanged, spaced has gap
 * ```
 */
export const gap = (box: Box, gapInput: PropGap.Input): Box => {
  const newBox = box.clone()
  newBox.gap$(gapInput)
  return newBox
}
