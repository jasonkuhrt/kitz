import type { Layer } from 'effect'
import type { AnyCommand, CommandLeaf, CommandHybrid } from './command.js'
import { CmxInvalidPath, CmxDuplicateNamespace } from './errors.js'

/** A shortcut maps a key to a command at an AppMap node. */
export interface Shortcut {
  readonly key: string
  readonly command: CommandLeaf | CommandHybrid
  /**
   * When true, this binding is only active when its node is the deepest in the path.
   * Default: false (inherited — active whenever this node is on the path).
   *
   * Use `local: true` for bindings that only make sense at their defining scope
   * (e.g. spatial navigation keys like h/j/k/l at the canvas root).
   * Use the default (inherited) for bindings that should be available at every depth
   * (e.g. scope navigation like i/o, or help toggles like ?).
   */
  readonly local?: boolean
}

/** A named region in the AppMap. */
export interface AppMapNode {
  readonly name: string
  readonly commands: ReadonlyArray<AnyCommand>
  readonly shortcuts: ReadonlyArray<Shortcut>
  readonly layer?: Layer.Layer<any> | undefined
  readonly children: ReadonlyArray<AppMapNode>
}

/** The root of the AppMap — implicit, no name. */
export interface AppMapRoot {
  readonly commands: ReadonlyArray<AnyCommand>
  readonly shortcuts: ReadonlyArray<Shortcut>
  readonly layer?: Layer.Layer<any> | undefined
  readonly children: ReadonlyArray<AppMapNode>
}

/** The computed visibility from an active path. */
export interface Scope {
  /** All visible commands, deepest-first. */
  readonly commands: ReadonlyArray<AnyCommand>
  /** All active shortcuts, deepest-first. Closer shadows farther for same key. */
  readonly shortcuts: ReadonlyArray<Shortcut>
  /** Namespace name → proximity value (higher = closer to active node). */
  readonly proximities: ReadonlyMap<string, number>
}

/**
 * Walk the AppMap from root to the target path, returning the chain of nodes.
 * Throws CmxInvalidPath if any segment is not found.
 */
const resolveChain = (
  root: AppMapRoot,
  path: ReadonlyArray<string>,
): ReadonlyArray<AppMapRoot | AppMapNode> => {
  const chain: (AppMapRoot | AppMapNode)[] = [root]
  let current: AppMapRoot | AppMapNode = root
  for (const segment of path) {
    const child: AppMapNode | undefined = current.children.find((c) => c.name === segment)
    if (!child) {
      throw new CmxInvalidPath({ context: { path: [...path] } })
    }
    chain.push(child)
    current = child
  }
  return chain
}

/**
 * Compute the scope from an AppMap at a given path.
 * Walks deepest-first, collecting commands, shortcuts, and proximity values.
 */
const computeScope = (root: AppMapRoot, path: ReadonlyArray<string>): Scope => {
  const chain = resolveChain(root, path)
  const commands: AnyCommand[] = []
  const shortcuts: Shortcut[] = []
  const proximities = new Map<string, number>()
  const seenNamespaces = new Map<string, string>()

  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i]!
    const proximity = i + 1 // deeper = higher proximity
    const nodeName = i === 0 ? '(root)' : (node as AppMapNode).name

    for (const cmd of node.commands) {
      const existing = seenNamespaces.get(cmd.name)
      if (existing) {
        throw new CmxDuplicateNamespace({
          context: { namespace: cmd.name, nodeA: existing, nodeB: nodeName },
        })
      }
      seenNamespaces.set(cmd.name, nodeName)
      commands.push(cmd)
      proximities.set(cmd.name, proximity)
    }

    for (const kb of node.shortcuts) {
      if (kb.local && i !== chain.length - 1) continue
      shortcuts.push(kb)
    }
  }

  return { commands, shortcuts, proximities }
}

/**
 * Resolve a shortcut at a given path. Returns the first match (closest node wins).
 */
const resolveShortcut = (
  root: AppMapRoot,
  path: ReadonlyArray<string>,
  key: string,
): Shortcut | null => {
  const chain = resolveChain(root, path)
  // Walk deepest-first — closer bindings shadow farther ones
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i]!
    for (const kb of node.shortcuts) {
      if (kb.local && i !== chain.length - 1) continue
      if (kb.key === key) return kb
    }
  }
  return null
}

/**
 * Get all active shortcuts at a path, grouped by scope level (deepest first).
 */
const getActiveShortcuts = (
  root: AppMapRoot,
  path: ReadonlyArray<string>,
): ReadonlyArray<{
  readonly nodeName: string
  readonly shortcuts: ReadonlyArray<Shortcut>
}> => {
  const chain = resolveChain(root, path)
  const result: { nodeName: string; shortcuts: ReadonlyArray<Shortcut> }[] = []
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i]!
    const nodeName = i === 0 ? '(root)' : (node as AppMapNode).name
    const activeShortcuts = node.shortcuts.filter((kb) => !kb.local || i === chain.length - 1)
    if (activeShortcuts.length > 0) {
      result.push({ nodeName, shortcuts: activeShortcuts })
    }
  }
  return result
}

export const AppMap = {
  make: (config: {
    readonly commands?: ReadonlyArray<AnyCommand>
    readonly shortcuts?: ReadonlyArray<Shortcut>
    readonly layer?: Layer.Layer<any> | undefined
    readonly children?: ReadonlyArray<AppMapNode>
  }): AppMapRoot => ({
    commands: config.commands ?? [],
    shortcuts: config.shortcuts ?? [],
    layer: config.layer,
    children: config.children ?? [],
  }),

  Node: {
    make: (config: {
      readonly name: string
      readonly commands?: ReadonlyArray<AnyCommand>
      readonly shortcuts?: ReadonlyArray<Shortcut>
      readonly layer?: Layer.Layer<any> | undefined
      readonly children?: ReadonlyArray<AppMapNode>
    }): AppMapNode => ({
      name: config.name,
      commands: config.commands ?? [],
      shortcuts: config.shortcuts ?? [],
      layer: config.layer,
      children: config.children ?? [],
    }),
  },

  computeScope,
  resolveShortcut,
  getActiveShortcuts,
} as const
