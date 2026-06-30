//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Types
//
//

/**
 * Uppercase letter.
 * @category Character Types
 */
export type LetterUpper =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z'

export type LettersLower = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
]

/**
 * Lowercase letter.
 * @category Character Types
 */
export type LetterLower = LettersLower[number]

/**
 * Any letter (uppercase or lowercase).
 * @category Character Types
 */
export type Letter = LetterLower | LetterUpper

/**
 * Digit character.
 * @category Character Types
 */
export type Digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'

/**
 * Hexadecimal letter (uppercase).
 *
 * Represents hex digits A-F in base-16 (values 10-15 in decimal).
 *
 * @category Character Types
 * @see https://en.wikipedia.org/wiki/Hexadecimal - Overview of hexadecimal number system
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toString - JavaScript hex conversion
 */
export type HexLetterUpper = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

/**
 * Hexadecimal letter (lowercase).
 *
 * Represents hex digits a-f in base-16 (values 10-15 in decimal).
 *
 * @category Character Types
 * @see https://en.wikipedia.org/wiki/Hexadecimal - Overview of hexadecimal number system
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toString - JavaScript hex conversion
 */
export type HexLetterLower = 'a' | 'b' | 'c' | 'd' | 'e' | 'f'

/**
 * Hexadecimal letter (uppercase or lowercase).
 *
 * Represents hex digits A-F or a-f in base-16 (values 10-15 in decimal).
 *
 * @category Character Types
 * @see https://en.wikipedia.org/wiki/Hexadecimal - Overview of hexadecimal number system
 */
export type HexLetter = HexLetterUpper | HexLetterLower

/**
 * Hexadecimal digit (0-9, A-F, a-f).
 *
 * Represents a single character in base-16 (hexadecimal) number system.
 * Used for colors (#FF5733), memory addresses, data encoding, etc.
 *
 * @category Character Types
 * @see https://en.wikipedia.org/wiki/Hexadecimal - Overview of hexadecimal number system
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toString - JavaScript hex conversion
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt - Parsing hex strings
 */
export type HexDigit = Digit | HexLetter

//
//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Values
//
//

/**
 * Non-breaking space character (U+00A0).
 * A space character that prevents line breaks at its position.
 * @category Character Constants
 * @see https://unicode-explorer.com/c/00A0
 */
export const spaceNoBreak = `\u00A0`

/**
 * Regular space character (U+0020).
 * The standard space character.
 * @category Character Constants
 * @see https://unicode-explorer.com/c/0020
 */
export const spaceRegular = `\u0020`

/**
 * Line feed (newline) character.
 * Used to create line breaks in text.
 * @category Character Constants
 */
export const newline = `\n`

/**
 * Bullet character (U+2022).
 * Standard bullet point symbol: •
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2022
 */
export const bullet = `\u2022`

/**
 * Middle dot character (U+00B7).
 * Centered dot symbol: ·
 * @category Character Constants
 * @see https://unicode-explorer.com/c/00B7
 */
export const middleDot = `\u00B7`

/** @see https://unicode-explorer.com/c/2219 */
// export const bulletOperator = `\u2219`

/**
 * Black circle character (U+25CF).
 * Filled circle symbol: ●
 * @category Character Constants
 * @see https://unicode-explorer.com/c/25CF
 */
export const blackCircle = `\u25CF`

/**
 * White bullet character (U+25E6).
 * Hollow circle symbol: ◦
 * @category Character Constants
 * @see https://unicode-explorer.com/c/25E6
 */
export const whiteBullet = `\u25E6`

/**
 * Inverse bullet character (U+25D8).
 * Inverse white circle symbol: ◘
 * @category Character Constants
 * @see https://unicode-explorer.com/c/25D8
 */
export const inverseBullet = `\u25D8`

/**
 * Square with left half black character (U+25E7).
 * Half-filled square symbol: ◧
 * @category Character Constants
 * @see https://unicode-explorer.com/c/25E7
 */
export const squareWithLeftHalfBlack = `\u25E7`

/**
 * Rightwards arrow character (U+2192).
 * Right-pointing arrow symbol: →
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2192
 */
export const rightwardsArrow = `\u2192`

/**
 * Vertical bar (pipe) character (U+007C).
 * Vertical line symbol: |
 * @category Character Constants
 * @see https://unicode-explorer.com/c/007C
 */
export const pipe = `|`

/**
 * Box drawing horizontal line character (U+2500).
 * Horizontal line symbol: ─
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2500
 */
export const boxDrawingHorizontal = `\u2500`

/**
 * Box drawing heavy horizontal line character (U+2501).
 * Bold horizontal line symbol: ━
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2501
 */
export const boxDrawingHorizontalHeavy = `\u2501`

/**
 * Box drawing vertical line character (U+2502).
 * Vertical line symbol: │
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2502
 */
export const boxDrawingVertical = `\u2502`

/**
 * Box drawing down and right character (U+250C).
 * Top-left corner symbol: ┌
 * @category Character Constants
 * @see https://unicode-explorer.com/c/250C
 */
export const boxDrawingDownRight = `\u250C`

/**
 * Box drawing down and left character (U+2510).
 * Top-right corner symbol: ┐
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2510
 */
export const boxDrawingDownLeft = `\u2510`

/**
 * Box drawing up and right character (U+2514).
 * Bottom-left corner symbol: └
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2514
 */
export const boxDrawingUpRight = `\u2514`

/**
 * Box drawing up and left character (U+2518).
 * Bottom-right corner symbol: ┘
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2518
 */
export const boxDrawingUpLeft = `\u2518`

/**
 * Ballot X character (U+2717).
 * X mark symbol: ✗
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2717
 */
export const ballotX = `\u2717`

/**
 * Multiplication X character (U+2715).
 * Multiplication X symbol: ✕
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2715
 */
export const multiplicationX = `\u2715`

/**
 * Check mark character (U+2713).
 * Check symbol: ✓
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2713
 */
export const checkMark = `\u2713`

/**
 * Black square character (U+25A0).
 * Filled square symbol: ■
 * @category Character Constants
 * @see https://unicode-explorer.com/c/25A0
 */
export const blackSquare = `\u25A0`

/**
 * White circle character (U+25CB).
 * Hollow circle symbol: ○
 * @category Character Constants
 * @see https://unicode-explorer.com/c/25CB
 */
export const whiteCircle = `\u25CB`

/**
 * Black up-pointing triangle character (U+25B2).
 * Filled upward triangle symbol: ▲
 * @category Character Constants
 * @see https://unicode-explorer.com/c/25B2
 */
export const blackUpPointingTriangle = `\u25B2`

/**
 * Em dash character (U+2014).
 * Long dash symbol: —
 * @category Character Constants
 * @see https://unicode-explorer.com/c/2014
 */
export const emDash = `\u2014`

/**
 * Exclamation mark character.
 * Often used for negation or emphasis: !
 * @category Character Constants
 */
export const exclamation = `!`

/**
 * Colon character.
 * Often used as a separator or delimiter: :
 * @category Character Constants
 */
export const colon = `:`

/**
 * Comma character.
 * Often used as a list separator: ,
 * @category Character Constants
 */
export const comma = `,`

/**
 * Asterisk character.
 * Often used as a wildcard or multiplication symbol: *
 * @category Character Constants
 */
export const asterisk = `*`

/**
 * At sign character.
 * Often used in email addresses and mentions: @
 * @category Character Constants
 */
export const at = `@`

/**
 * Plus sign character.
 * Used for addition or positive values: +
 * @category Character Constants
 */
export const plus = `+`

/**
 * Hyphen/minus character.
 * Used for subtraction, ranges, or negative values: -
 * @category Character Constants
 */
export const hyphen = `-`
