import type { String } from '../string/_.js'

/**
 * Branded string literal carrying a static error message.
 *
 * The message itself is the guarded parameter's type, so the full sentence
 * renders inline in the call-site diagnostic ("Argument of type '…' is not
 * assignable to parameter of type '"<message>"'"). An object-shaped error
 * type renders only its alias name there, hiding the message behind
 * go-to-definition. The zero-width-space brand is invisible in diagnostics
 * yet keeps every user string un-assignable to the error type.
 */
export type StaticError<$Message extends string> = `${$Message}${String.ZeroWidthSpace}`
