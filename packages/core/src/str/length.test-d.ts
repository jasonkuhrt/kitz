import type { Type as A } from '#kitz/assert/assert'
import type { Ts } from '#ts'
import type { Length } from './length.js'

//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Length Fast Path (0-20 chars)
//
//
//

// Fast path range - all should resolve to literal number types
type _ = A.Cases<
  // Edge cases
  A.exact<Length<''>, 0>,
  A.exact<Length<'a'>, 1>,
  // Fast path range
  A.exact<Length<'hello'>, 5>,
  A.exact<Length<'helloworld'>, 10>,
  A.exact<Length<'123456789012345'>, 15>,
  A.exact<Length<'12345678901234567890'>, 20>
>

//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Length Non-Literal Strings
//
//
//

// Non-literal string should return number
type _nonLiteral = A.Cases<
  A.exact<Length<string>, number>
>

// Template literal type with string interpolation should return number
type _templateLiteral = A.Cases<
  A.exact.number<Length<`a${string}`>>
>

//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Length Gate (>20 chars without flag)
//
//
//

// 21 chars should return StaticError without allowSlow flag
type _error21chars = Length<'123456789012345678901'>
type _verify21chars = A.Cases<
  A.exact.true<Ts.Err.Is<_error21chars>>
>

// Long string should return StaticError without allowSlow flag
type _errorLongString = Length<'this string is definitely over 20 characters long'>
type _verifyLongString = A.Cases<
  A.exact.true<Ts.Err.Is<_errorLongString>>
>

// Another test case - verify error contains helpful message
type _errorCheck = Length<'over 20 characters here'>
type _errorVerify = A.Cases<
  A.exact.true<Ts.Err.Is<_errorCheck>>
>

//
//
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ • Length Local Override (>20 chars with local true)
//
//
//

// 21 chars with local override should work
type _localOverride21 = Length<'123456789012345678901', true>
type _verifyLocalOverride = A.Cases<
  A.exact<_localOverride21, 21>
>

// Long string with local override should work
type _localOverrideLong = Length<'this string is over 20 characters long', true>
type _verifyLocalOverrideLong = A.Cases<
  A.exact<_localOverrideLong, 38>
>
