/** A single entry in the choices list. */
export interface Choice {
  readonly token: string
  readonly kind: 'leaf' | 'namespace' | 'hybrid' | 'value'
  readonly executable: boolean
  readonly description?: string | undefined
  readonly detail?: string | undefined
  readonly icon?: string | undefined
  readonly badge?: string | undefined
  readonly shortcut?: string | undefined
  readonly warning?: string | undefined
  readonly deprecated?: { readonly replacement: string } | undefined
  readonly group?: string | undefined
  readonly aliases?: ReadonlyArray<string> | undefined
}

/** An accepted command token with the query that was active when it was taken. */
export interface AcceptedToken {
  readonly token: string
  readonly preTakeQuery: string
}
