import { Effect } from 'effect'
import type { AnyCommand, CommandLeaf, CommandHybrid } from './command.js'
import { collectExecutablePaths } from './command.js'
import type { Choice, AcceptedToken } from './choice.js'
import type { AnyCapability } from './capability.js'
import type { Resolution } from './resolution.js'
import type { MatcherService } from './matcher.js'
import { Matcher } from './matcher.js'

/** Internal state for the Command Resolver. */
interface CommandResolverState {
  mode: 'flat' | 'tree'
  acceptedTokens: AcceptedToken[]
  query: string
  /** The full command tree (all visible commands). */
  commands: ReadonlyArray<AnyCommand>
  /** Proximities by namespace name. */
  proximities: ReadonlyMap<string, number>
  /** Current namespace path for tree mode. */
  treePath: string[]
}

/**
 * Build flat-mode choices: all executable commands as full paths.
 */
const buildFlatChoices = (
  commands: ReadonlyArray<AnyCommand>,
  proximities: ReadonlyMap<string, number>,
): Choice[] => {
  const paths = collectExecutablePaths(commands)
  return paths.map(
    (p): Choice => ({
      token: p.path,
      kind: p.command._tag === 'Hybrid' ? 'hybrid' : 'leaf',
      executable: p.command._tag === 'Leaf' || p.command._tag === 'Hybrid',
      description: p.command.description,
      detail: p.command.detail,
      icon: p.command.icon,
      badge: p.command.badge,
      warning: p.command.warning,
      deprecated: p.command.deprecated,
      group: p.command.group,
      aliases: p.command.aliases,
      _command: p.command,
    }),
  )
}

/**
 * Build tree-mode choices: children of the current namespace.
 */
const buildTreeChoices = (commands: ReadonlyArray<AnyCommand>, treePath: string[]): Choice[] => {
  let current: ReadonlyArray<AnyCommand> = commands
  for (const segment of treePath) {
    const node = current.find((c) => c.name === segment)
    if (!node || node._tag === 'Leaf') return []
    current = node._tag === 'Namespace' || node._tag === 'Hybrid' ? node.children : []
  }
  return current.map(
    (cmd): Choice => ({
      token: cmd.name,
      kind: cmd._tag === 'Leaf' ? 'leaf' : cmd._tag === 'Namespace' ? 'namespace' : 'hybrid',
      executable: cmd._tag === 'Leaf' || cmd._tag === 'Hybrid',
      description: cmd.description,
      aliases: cmd.aliases,
      _command: cmd,
    }),
  )
}

/** Score and rank choices through the pluggable Matcher. */
const matchChoices = (
  choices: ReadonlyArray<Choice>,
  query: string,
  matcher: MatcherService,
  proximities: ReadonlyMap<string, number>,
): Choice[] => {
  const candidates = choices.map((c) => ({
    text: c.aliases?.length ? `${c.token} ${c.aliases.join(' ')}` : c.token,
    boost: proximities.get(c.token.split(' ')[0]!) ?? 0,
    _choice: c,
  }))
  const results = matcher.match(candidates, query)
  return results.map((r) => r.candidate._choice)
}

/**
 * Find the command for an accepted path in the command tree.
 */
const findCommand = (commands: ReadonlyArray<AnyCommand>, path: string[]): AnyCommand | null => {
  let current: ReadonlyArray<AnyCommand> = commands
  for (let i = 0; i < path.length; i++) {
    const segment = path[i]
    const node = current.find((c) => c.name === segment)
    if (!node) return null
    if (i === path.length - 1) return node
    if (node._tag === 'Namespace' || node._tag === 'Hybrid') {
      current = node.children
    } else {
      return null
    }
  }
  return null
}

/** Build a sequential effect from a capability (simple or composite). */
const buildCapabilityEffect = (cap: AnyCapability): Effect.Effect<void> => {
  if (cap._tag === 'Capability') return cap.execute
  const effects: Effect.Effect<void>[] = []
  const collect = (c: AnyCapability): void => {
    if (c._tag === 'Capability') {
      effects.push(c.execute)
    } else {
      for (const step of c.steps) collect(step.capability)
    }
  }
  collect(cap)
  return Effect.all(effects, { discard: true })
}

/** Build a Resolution from the current state. */
const buildResolution = (state: CommandResolverState, matcher: MatcherService): Resolution => {
  const rawChoices =
    state.mode === 'flat'
      ? buildFlatChoices(state.commands, state.proximities)
      : buildTreeChoices(state.commands, state.treePath)

  const choices = matchChoices(rawChoices, state.query, matcher, state.proximities)
  const topChoice = choices.length > 0 ? choices[0]! : null
  const complete = topChoice !== null && topChoice.token.toLowerCase() === state.query.toLowerCase()

  // Determine _tag and executable from accepted tokens
  let tag: Resolution['_tag'] = 'None'
  let executable = false
  let effect: Resolution['effect'] = null

  if (state.mode === 'flat' && state.acceptedTokens.length > 0) {
    // In flat mode, accepted token is the full path like "Config reload"
    const lastToken = state.acceptedTokens[state.acceptedTokens.length - 1]!
    const pathSegments = lastToken.token.split(' ')
    const cmd = findCommand(state.commands, pathSegments)
    if (cmd) {
      tag = cmd._tag as Resolution['_tag']
      if ((cmd._tag === 'Leaf' || cmd._tag === 'Hybrid') && 'capability' in cmd) {
        const cap = cmd.capability
        executable = cap.slots.length === 0
        effect = cap.slots.length === 0 ? buildCapabilityEffect(cap) : null
      }
    }
  } else if (state.mode === 'tree' && state.acceptedTokens.length > 0) {
    const pathSegments = state.acceptedTokens.map((t) => t.token)
    const cmd = findCommand(state.commands, pathSegments)
    if (cmd) {
      tag = cmd._tag as Resolution['_tag']
      if ((cmd._tag === 'Leaf' || cmd._tag === 'Hybrid') && 'capability' in cmd) {
        const cap = cmd.capability
        executable = cap.slots.length === 0
        effect = cap.slots.length === 0 ? buildCapabilityEffect(cap) : null
      }
    }
  }

  return {
    mode: state.mode,
    acceptedTokens: state.acceptedTokens,
    query: state.query,
    _tag: tag,
    executable,
    effect,
    complete,
    topChoice,
    choices,
    choicesLoading: false,
    slots: [],
    focusedSlot: null,
  }
}

/** Create a new Command Resolver. */
export const CommandResolver = {
  create: (
    commands: ReadonlyArray<AnyCommand>,
    proximities: ReadonlyMap<string, number>,
    matcher: MatcherService = Matcher.substring(),
  ) => {
    const state: CommandResolverState = {
      mode: 'flat',
      acceptedTokens: [],
      query: '',
      commands,
      proximities,
      treePath: [],
    }

    const getResolution = (): Resolution => buildResolution(state, matcher)

    const queryPush = (char: string): Resolution => {
      // Space handling
      if (char === ' ' && state.mode === 'flat') {
        // Auto-advance top choice
        const resolution = buildResolution(state, matcher)
        if (resolution.topChoice && state.query.length > 0) {
          state.acceptedTokens.push({
            token: resolution.topChoice.token,
            preTakeQuery: state.query,
          })
          state.query = ''
          return buildResolution(state, matcher)
        }
        return resolution
      }

      // Try adding the character
      const newQuery = state.query + char
      const rawChoices =
        state.mode === 'flat'
          ? buildFlatChoices(state.commands, state.proximities)
          : buildTreeChoices(state.commands, state.treePath)
      const filtered = matchChoices(rawChoices, newQuery, matcher, state.proximities)

      // Dead-end prevention: reject if zero matches
      if (filtered.length === 0) {
        return buildResolution(state, matcher)
      }

      state.query = newQuery

      // Auto-advance: if exactly 1 choice, take it
      if (filtered.length === 1) {
        const taken = filtered[0]!
        state.acceptedTokens.push({
          token: taken.token,
          preTakeQuery: state.query,
        })
        state.query = ''
        // In tree mode, descend into the namespace/hybrid if it has children
        if (state.mode === 'tree' && (taken.kind === 'namespace' || taken.kind === 'hybrid')) {
          state.treePath.push(taken.token)
        }
      }

      return buildResolution(state, matcher)
    }

    const queryUndo = (): Resolution => {
      if (state.query.length > 0) {
        state.query = state.query.slice(0, -1)
      } else if (state.acceptedTokens.length > 0) {
        const last = state.acceptedTokens.pop()!
        state.query = last.preTakeQuery
        // In tree mode, only pop treePath if the popped token matches
        // the current treePath tail (meaning it was a namespace/hybrid
        // that pushed onto treePath when taken). Leaf tokens don't push
        // to treePath, so undoing them shouldn't pop it.
        if (
          state.mode === 'tree' &&
          state.treePath.length > 0 &&
          state.treePath[state.treePath.length - 1] === last.token
        ) {
          state.treePath.pop()
        }
      }
      return buildResolution(state, matcher)
    }

    const choiceTakeTop = (): Resolution => {
      const resolution = buildResolution(state, matcher)
      if (resolution.topChoice) {
        state.acceptedTokens.push({
          token: resolution.topChoice.token,
          preTakeQuery: state.query,
        })
        state.query = ''
        // If the taken choice is a namespace or hybrid in tree mode, descend
        if (
          state.mode === 'tree' &&
          (resolution.topChoice.kind === 'namespace' || resolution.topChoice.kind === 'hybrid')
        ) {
          state.treePath.push(resolution.topChoice.token)
        }
      }
      return buildResolution(state, matcher)
    }

    const choiceTake = (choice: Choice): Resolution => {
      state.acceptedTokens.push({
        token: choice.token,
        preTakeQuery: state.query,
      })
      state.query = ''
      if (state.mode === 'tree' && (choice.kind === 'namespace' || choice.kind === 'hybrid')) {
        state.treePath.push(choice.token)
      }
      return buildResolution(state, matcher)
    }

    const choiceUndo = (): Resolution => {
      state.query = ''
      if (state.acceptedTokens.length > 0) {
        const last = state.acceptedTokens.pop()!
        // Only pop treePath if the popped token matches the treePath tail
        // (meaning it was a namespace/hybrid that pushed when taken).
        // Leaf tokens don't push to treePath, so undoing them shouldn't pop.
        if (
          state.mode === 'tree' &&
          state.treePath.length > 0 &&
          state.treePath[state.treePath.length - 1] === last.token
        ) {
          state.treePath.pop()
        }
      }
      return buildResolution(state, matcher)
    }

    const toggleMode = (): Resolution => {
      if (state.mode === 'flat') {
        state.mode = 'tree'
        state.treePath = []
        state.query = ''
        state.acceptedTokens = []
      } else {
        state.mode = 'flat'
        state.treePath = []
        state.query = ''
        state.acceptedTokens = []
      }
      return buildResolution(state, matcher)
    }

    const reset = (): Resolution => {
      state.mode = 'flat'
      state.acceptedTokens = []
      state.query = ''
      state.treePath = []
      return buildResolution(state, matcher)
    }

    return {
      getResolution,
      queryPush,
      queryUndo,
      choiceTakeTop,
      choiceTake,
      choiceUndo,
      toggleMode,
      reset,
    }
  },
} as const
