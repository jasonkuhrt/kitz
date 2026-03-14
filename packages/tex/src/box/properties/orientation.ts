import { Schema as S } from 'effect'

/**
 * Orientation determines the flow direction of the box.
 *
 * - `vertical`: Content flows top-to-bottom (main axis = vertical)
 * - `horizontal`: Content flows left-to-right (main axis = horizontal)
 *
 * @category Text Formatting
 */
export const Orientation = S.Literals(['vertical', 'horizontal'])

/**
 * Orientation type.
 *
 * @category Text Formatting
 */
export type Orientation = typeof Orientation.Type
