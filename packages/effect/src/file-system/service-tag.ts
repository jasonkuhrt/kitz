/**
 * Effect's exact filesystem service identity and interface, re-exported as-is so
 * that `FileSystem.FileSystem` mirrors Effect's own `FileSystem.FileSystem`
 * service access. This is an alias, not a Kitz-owned `Context.Service`: official
 * Effect platform layers and Kitz's memory layer satisfy the same requirement.
 */
export { FileSystem } from 'effect/FileSystem'
