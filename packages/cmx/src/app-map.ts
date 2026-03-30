import type { Layer } from 'effect'
import type { AnyCommand, CommandLeaf, CommandHybrid } from './command.js'
import { CmxInvalidPath, CmxDuplicateNamespace } from './errors.js'

/** A keybinding maps a key to a command at an AppMap node. */
export interface Keybinding {
  readonly key: string
  readonly command: CommandLeaf | CommandHybrid
}

/** A named region in the AppMap. */
export interface AppMapNode {
  readonly name: string
  readonly commands: ReadonlyArray<AnyCommand>
  readonly keybindings: ReadonlyArray<Keybinding>
  readonly layer?: Layer.Layer<any> | undefined
  readonly children: ReadonlyArray<AppMapNode>
}

/** The root of the AppMap — implicit, no name. */
export interface AppMapRoot {
  readonly commands: ReadonlyArray<AnyCommand>
  readonly keybindings: ReadonlyArray<Keybinding>
  readonly layer?: Layer.Layer<any> | undefined
  readonly children: ReadonlyArray<AppMapNode>
}

/** The computed visibility from an active path. */
export interface Scope {
  /** All visible commands, deepest-first. */
  readonly commands: ReadonlyArray<AnyCommand>
  /** All active keybindings, deepest-first. Closer shadows farther for same key. */
  readonly keybindings: ReadonlyArray<Keybinding>
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
 * Walks deepest-first, collecting commands, keybindings, and proximity values.
 */
const computeScope = (root: AppMapRoot, path: ReadonlyArray<string>): Scope => {
  const chain = resolveChain(root, path)
  const commands: AnyCommand[] = []
  const keybindings: Keybinding[] = []
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

    for (const kb of node.keybindings) {
      keybindings.push(kb)
    }
  }

  return { commands, keybindings, proximities }
}

/**
 * Resolve a keybinding at a given path. Returns the first match (closest node wins).
 */
const resolveKeybinding = (
  root: AppMapRoot,
  path: ReadonlyArray<string>,
  key: string,
): Keybinding | null => {
  const chain = resolveChain(root, path)
  // Walk deepest-first — closer bindings shadow farther ones
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i]!
    for (const kb of node.keybindings) {
      if (kb.key === key) return kb
    }
  }
  return null
}

/**
 * Get all active keybindings at a path, grouped by scope level (deepest first).
 */
const getActiveKeybindings = (
  root: AppMapRoot,
  path: ReadonlyArray<string>,
): ReadonlyArray<{
  readonly nodeName: string
  readonly keybindings: ReadonlyArray<Keybinding>
}> => {
  const chain = resolveChain(root, path)
  const result: { nodeName: string; keybindings: ReadonlyArray<Keybinding> }[] = []
  for (let i = chain.length - 1; i >= 0; i--) {
    const node = chain[i]!
    const nodeName = i === 0 ? '(root)' : (node as AppMapNode).name
    if (node.keybindings.length > 0) {
      result.push({ nodeName, keybindings: node.keybindings })
    }
  }
  return result
}

export const AppMap = {
  make: (config: {
    readonly commands?: ReadonlyArray<AnyCommand>
    readonly keybindings?: ReadonlyArray<Keybinding>
    readonly layer?: Layer.Layer<any> | undefined
    readonly children?: ReadonlyArray<AppMapNode>
  }): AppMapRoot => ({
    commands: config.commands ?? [],
    keybindings: config.keybindings ?? [],
    layer: config.layer,
    children: config.children ?? [],
  }),

  Node: {
    make: (config: {
      readonly name: string
      readonly commands?: ReadonlyArray<AnyCommand>
      readonly keybindings?: ReadonlyArray<Keybinding>
      readonly layer?: Layer.Layer<any> | undefined
      readonly children?: ReadonlyArray<AppMapNode>
    }): AppMapNode => ({
      name: config.name,
      commands: config.commands ?? [],
      keybindings: config.keybindings ?? [],
      layer: config.layer,
      children: config.children ?? [],
    }),
  },

  computeScope,
  resolveKeybinding,
  getActiveKeybindings,
} as const
