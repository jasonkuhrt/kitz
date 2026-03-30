import type { AnyCapability } from './capability.js'

/** Shared documentation fields for all command kinds. */
interface CommandDocumentation {
  readonly description?: string
  readonly detail?: string
  readonly icon?: string
  readonly badge?: string
  readonly examples?: ReadonlyArray<string>
  readonly related?: ReadonlyArray<string>
  readonly warning?: string
  readonly confirmation?: boolean
  readonly aliases?: ReadonlyArray<string>
  readonly tags?: ReadonlyArray<string>
  readonly deprecated?: { readonly replacement: string }
  readonly group?: string
}

/** Executable terminal command. */
export interface CommandLeaf extends CommandDocumentation {
  readonly _tag: 'Leaf'
  readonly name: string
  readonly capability: AnyCapability
}

/** Non-executable grouping. Carries children. */
export interface CommandNamespace extends CommandDocumentation {
  readonly _tag: 'Namespace'
  readonly name: string
  readonly children: ReadonlyArray<AnyCommand>
}

/** Executable with children. */
export interface CommandHybrid extends CommandDocumentation {
  readonly _tag: 'Hybrid'
  readonly name: string
  readonly capability: AnyCapability
  readonly children: ReadonlyArray<AnyCommand>
}

/** Any command kind. */
export type AnyCommand = CommandLeaf | CommandNamespace | CommandHybrid

export const Command = {
  Leaf: {
    make: (config: Omit<CommandLeaf, '_tag'>): CommandLeaf => ({
      _tag: 'Leaf',
      ...config,
    }),
  },

  Namespace: {
    make: (config: Omit<CommandNamespace, '_tag'>): CommandNamespace => ({
      _tag: 'Namespace',
      ...config,
    }),

    /**
     * Generate a namespace from capabilities. Returns the namespace and a typed
     * record of the generated leaf commands (for use in keybindings, related, etc.).
     */
    fromCapabilities: <K extends string>(config: {
      readonly name: string
      readonly description?: string
      readonly capabilities: Readonly<Record<K, AnyCapability>>
    }): { readonly namespace: CommandNamespace; readonly commands: Readonly<Record<K, CommandLeaf>> } => {
      const commands = {} as Record<K, CommandLeaf>
      const children: CommandLeaf[] = []
      for (const [key, cap] of Object.entries<AnyCapability>(config.capabilities)) {
        const leaf: CommandLeaf = { _tag: 'Leaf', name: cap.name, capability: cap }
        commands[key as K] = leaf
        children.push(leaf)
      }
      return {
        namespace: {
          _tag: 'Namespace',
          name: config.name,
          description: config.description,
          children,
        },
        commands,
      }
    },
  },

  Hybrid: {
    make: (config: Omit<CommandHybrid, '_tag'>): CommandHybrid => ({
      _tag: 'Hybrid',
      ...config,
    }),
  },
} as const

/**
 * Collect all executable leaf paths from a command tree.
 * Returns full paths like "Config reload", "Lsp refactor rename".
 */
export const collectExecutablePaths = (
  commands: ReadonlyArray<AnyCommand>,
  prefix: string = '',
): ReadonlyArray<{ readonly path: string; readonly command: CommandLeaf | CommandHybrid }> => {
  const result: { path: string; command: CommandLeaf | CommandHybrid }[] = []
  for (const cmd of commands) {
    const fullPath = prefix ? `${prefix} ${cmd.name}` : cmd.name
    switch (cmd._tag) {
      case 'Leaf':
        result.push({ path: fullPath, command: cmd })
        break
      case 'Hybrid':
        result.push({ path: fullPath, command: cmd })
        result.push(...collectExecutablePaths(cmd.children, fullPath))
        break
      case 'Namespace':
        result.push(...collectExecutablePaths(cmd.children, fullPath))
        break
    }
  }
  return result
}
