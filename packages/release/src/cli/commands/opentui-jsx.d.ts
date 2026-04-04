// Augment JSX namespace with OpenTUI intrinsic elements.
// This is needed because tsgo doesn't resolve @opentui/react/jsx-runtime
// from the jsxImportSource config. The runtime resolution works fine (Bun).
import type { BoxProps, CodeProps, DiffProps, ScrollBoxProps, TextProps } from '@opentui/react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      box: BoxProps
      text: TextProps
      scrollbox: ScrollBoxProps
      diff: DiffProps
      code: CodeProps
    }
  }
}
