import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Option from 'effect/Option'
import * as PlatformError from 'effect/PlatformError'
import * as Result from 'effect/Result'
import * as Schema from 'effect/Schema'
import * as Path from '../../path/__.js'

type InodeId = number

/** A node in the in-memory filesystem graph: a directory of named children or a byte buffer. */
export type Inode = Data.TaggedEnum<{
  Directory: {
    readonly parent: InodeId
    readonly entries: HashMap.HashMap<Path.Segment, InodeId>
  }
  File: { readonly bytes: Uint8Array }
}>

const Inode = Data.taggedEnum<Inode>()

/** The whole in-memory filesystem: a root, a cwd, and an inode table. */
export interface State {
  readonly root: InodeId
  readonly cwd: InodeId
  readonly nextInodeId: InodeId
  readonly inodes: HashMap.HashMap<InodeId, Inode>
}

const root = 0

/** A fresh filesystem: an empty root directory that is also the cwd. */
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
  const requiresDirectory = path.endsWith('/') || finalComponent === '.' || finalComponent === '..'
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
