/**
 * Language utilities for type inspection and formatting.
 *
 * Provides utilities for type guards, value inspection, colorized output,
 * and common JavaScript primitives handling.
 *
 * @category Domains
 */
export * as Lang from './__.js'

// Disabled: Merging a namespace declaration with `export * as` breaks
// TypeScript's control flow analysis for never-returning functions
// (panic, throw, neverCase, todo), preventing type narrowing after
// guard checks like `if (x === null) Lang.panic(...)`.
//
// To re-enable, uncomment both lines below:
// /* @ts-expect-error Duplicate identifier */
// export namespace Lang {}
