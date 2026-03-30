/** A single entry in the choices list. */
export interface Choice {
  readonly token: string
  readonly kind: 'leaf' | 'namespace' | 'hybrid' | 'value'
  readonly executable: boolean
  readonly description?: string
  readonly detail?: string
  readonly icon?: string
  readonly badge?: string
  readonly keybinding?: string
  readonly warning?: string
  readonly deprecated?: { readonly replacement: string }
  readonly group?: string
}

/** An accepted command token with the query that was active when it was taken. */
export interface AcceptedToken {
  readonly token: string
  readonly preTakeQuery: string
}
