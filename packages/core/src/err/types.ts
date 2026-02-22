/**
 * Context information that can be attached to errors.
 * Must be an object to ensure it can be properly serialized and inspected.
 *
 * @category Types
 */
export type Context = object

/**
 * An error that includes additional context information.
 *
 * @deprecated Use {@link TaggedContextualError} factory instead for better type safety.
 * @category Types
 */
export interface ErrorWithContext extends Error {
  /**
   * Additional context information about the error.
   */
  context?: Context
}
