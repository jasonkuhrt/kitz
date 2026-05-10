// Workspace test preload — runs before all bun:test files.
//
// React's `act()` checks for a global flag to determine if it's running
// inside a test environment. Vitest sets this automatically; bun:test does
// not. Without it, every state update triggers a noisy "An update inside a
// test was not wrapped in act(...)" warning even though the wrapping is
// in fact correct.
//
// Setting the flag is safe in non-React tests (it's a no-op there).

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true
