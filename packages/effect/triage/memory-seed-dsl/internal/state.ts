import * as Array from 'effect/Array'
import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Option from 'effect/Option'
import * as PlatformError from 'effect/PlatformError'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import type { Entry } from '../entry.js'
import { InitializationError } from '../InitializationError.js'
import * as Path from '../../path/__.js'

type InodeId = number

export type Inode = Data.TaggedEnum<{
  Directory: {
    readonly parent: InodeId
    readonly entries: HashMap.HashMap<Path.Segment, InodeId>
  }
  File: { readonly bytes: Uint8Array }
}>

const Inode = Data.taggedEnum<Inode>()

export interface State {
  readonly root: InodeId
  readonly cwd: InodeId
  readonly nextInodeId: InodeId
  readonly inodes: HashMap.HashMap<InodeId, Inode>
}

interface Located {
  readonly id: InodeId
  readonly inode: Inode
}

const root = 0

export const emptyState = (): State => ({
  root,
  cwd: root,
  nextInodeId: 1,
  inodes: HashMap.make([
    root,
    Inode.Directory({
      parent: root,
      entries: HashMap.empty<Path.Segment, InodeId>(),
    }),
  ]),
})

const locate = (
  state: State,
  start: InodeId,
  segments: ReadonlyArray<Path.Segment>,
): Located | undefined => {
  let id = start
  let inode = Option.getOrUndefined(HashMap.get(state.inodes, id))
  if (inode === undefined) return undefined

  for (const segment of segments) {
    if (inode._tag !== 'Directory') return undefined
    const child = Option.getOrUndefined(HashMap.get(inode.entries, segment))
    if (child === undefined) return undefined
    id = child
    inode = Option.getOrUndefined(HashMap.get(state.inodes, id))
    if (inode === undefined) return undefined
  }

  return { id, inode }
}

const initializationFailure = (
  reason: InitializationError['reason'],
  path: string,
): InitializationError => new InitializationError({ reason, path })

interface EntryAddress {
  readonly encoded: string
  readonly name: Path.Segment | undefined
  readonly parentSegments: ReadonlyArray<Path.Segment>
}

const entryAddress = (entry: Entry, cwd: Path.AbsDir): EntryAddress => {
  if (entry._tag === 'Directory') {
    const absolute = Path.ensureAbs(entry.path, cwd)
    return {
      encoded: absolute.toString(),
      name: Option.getOrUndefined(Array.last(absolute.segments)),
      parentSegments: Array.dropRight(absolute.segments, 1),
    }
  }

  const absolute = Path.ensureAbs(entry.path, cwd)
  return {
    encoded: absolute.toString(),
    name: Path.segment(absolute.name),
    parentSegments: absolute.dir.segments,
  }
}

const insert = (
  state: State,
  entry: Entry,
  cwd: Path.AbsDir,
): Result.Result<State, InitializationError> => {
  const address = entryAddress(entry, cwd)

  // `/` is born with every layer and cannot be seeded a second time.
  if (address.name === undefined) {
    return Result.fail(initializationFailure('DuplicateEntry', address.encoded))
  }

  const parent = locate(state, state.root, address.parentSegments)
  if (parent === undefined || parent.inode._tag !== 'Directory') {
    return Result.fail(initializationFailure('MissingParent', address.encoded))
  }
  if (HashMap.has(parent.inode.entries, address.name)) {
    return Result.fail(initializationFailure('DuplicateEntry', address.encoded))
  }

  const id = state.nextInodeId
  const inode =
    entry._tag === 'Directory'
      ? Inode.Directory({
          parent: parent.id,
          entries: HashMap.empty<Path.Segment, InodeId>(),
        })
      : Inode.File({ bytes: Uint8Array.from(entry.bytes) })
  const updatedParent = Inode.Directory({
    parent: parent.inode.parent,
    entries: HashMap.set(parent.inode.entries, address.name, id),
  })

  return Result.succeed({
    ...state,
    nextInodeId: id + 1,
    inodes: HashMap.set(HashMap.set(state.inodes, parent.id, updatedParent), id, inode),
  })
}

export const initialize = (
  cwd: Path.AbsDir,
  entries: Iterable<Entry>,
): Result.Result<State, InitializationError> => {
  let state = emptyState()

  for (const entry of entries) {
    const next = insert(state, entry, cwd)
    if (Result.isFailure(next)) return next
    state = next.success
  }

  const locatedCwd = locate(state, state.root, cwd.segments)
  if (locatedCwd === undefined) {
    return Result.fail(initializationFailure('MissingCwd', cwd.toString()))
  }
  if (locatedCwd.inode._tag !== 'Directory') {
    return Result.fail(initializationFailure('CwdNotDirectory', cwd.toString()))
  }

  return Result.succeed({ ...state, cwd: locatedCwd.id })
}

const systemError = (
  reason: 'NotFound' | 'BadResource',
  path: string,
): PlatformError.PlatformError =>
  PlatformError.systemError({
    _tag: reason,
    module: 'FileSystem',
    method: 'access',
    pathOrDescriptor: path,
    description: reason === 'NotFound' ? 'No such file or directory' : 'Not a directory',
  })

const badPath = (path: string, cause: unknown): PlatformError.PlatformError =>
  PlatformError.badArgument({
    module: 'FileSystem',
    method: 'access',
    description: `invalid path: ${path}`,
    cause,
  })

/** Resolve an arbitrary upstream POSIX path against the inode graph. */
export const walk = (
  state: State,
  path: string,
): Result.Result<Inode, PlatformError.PlatformError> => {
  if (path.length === 0) return Result.fail(systemError('NotFound', path))

  const components = path.split('/')
  const finalComponent = components.at(-1)
  const requiresDirectory =
    path.endsWith('/') || finalComponent === '.' || finalComponent === '..'
  let id = path.startsWith('/') ? state.root : state.cwd
  let inode = Option.getOrUndefined(HashMap.get(state.inodes, id))

  if (inode === undefined) return Result.fail(systemError('NotFound', path))

  for (const component of components) {
    if (component === '') continue
    if (inode._tag !== 'Directory') return Result.fail(systemError('BadResource', path))
    if (component === '.') continue
    if (component === '..') {
      id = inode.parent
      inode = Option.getOrUndefined(HashMap.get(state.inodes, id))
      if (inode === undefined) return Result.fail(systemError('NotFound', path))
      continue
    }

    const segment = Schema.decodeResult(Path.Segment)(component)
    if (Result.isFailure(segment)) return Result.fail(badPath(path, segment.failure))
    const child = Option.getOrUndefined(HashMap.get(inode.entries, segment.success))
    if (child === undefined) return Result.fail(systemError('NotFound', path))
    id = child
    inode = Option.getOrUndefined(HashMap.get(state.inodes, id))
    if (inode === undefined) return Result.fail(systemError('NotFound', path))
  }

  return requiresDirectory && inode._tag !== 'Directory'
    ? Result.fail(systemError('BadResource', path))
    : Result.succeed(inode)
}
