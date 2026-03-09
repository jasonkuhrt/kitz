import { Schema } from 'effect'

/**
 * Schema for package manager link protocols.
 * Validates link protocol values: 'link' or 'file'.
 */
export const LinkProtocol = Schema.Enums({
  link: 'link',
  file: 'file',
} as const)

/**
 * Type representing package manager link protocols.
 * Can be either 'link' or 'file'.
 */
export type LinkProtocol = Schema.Schema.Type<typeof LinkProtocol>
