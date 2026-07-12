/** Shared lexical tokens for the runtime and type-level POSIX path grammars. */
export const separator = '/'
export type separator = typeof separator

export const here = '.'
export type here = typeof here

export const ascent = '..'
export type ascent = typeof ascent

export const herePrefix = `${here}${separator}`
export type herePrefix = typeof herePrefix

export const ascentPrefix = `${ascent}${separator}`
export type ascentPrefix = typeof ascentPrefix

export const nullByte = '\0'
export type nullByte = typeof nullByte
