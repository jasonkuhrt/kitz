import { SystemError } from '@effect/platform/Error'
import { FileSystem } from '@effect/platform/FileSystem'
import { Effect, Layer } from 'effect'

const createUnsupportedError = (method: string, operation: string) =>
  new SystemError({
    reason: 'PermissionDenied',
    module: 'FileSystem',
    method,
    description: `${operation} not supported in memory filesystem`,
  })

const createNotFoundError = (method: string, path: string, operation: string) =>
  new SystemError({
    reason: 'NotFound',
    module: 'FileSystem',
    method,
    pathOrDescriptor: path,
    description: `ENOENT: no such file or directory, ${operation} '${path}'`,
  })

const failUnsupported = (method: string, operation: string) =>
  Effect.fail(createUnsupportedError(method, operation))

const failNotFound = (method: string, path: string, operation: string) =>
  Effect.fail(createNotFoundError(method, path, operation))

/**
 * Memory filesystem disk layout specification.
 * Keys are file paths, values are file contents as strings or Uint8Array.
 *
 * @example
 * ```ts
 * const diskLayout: DiskLayout = {
 *   '/config.json': '{"version": "1.0.0"}',
 *   '/src/index.js': 'console.log("Hello")',
 *   '/README.md': '# My Project'
 * }
 * ```
 */
export interface DiskLayout {
  [path: string]: string | Uint8Array
}

/**
 * Creates a memory filesystem layer from a disk layout specification.
 * This layer can be composed with other layers for testing.
 * Provides a fully functional in-memory filesystem implementation.
 *
 * @param diskLayout - Object mapping file paths to their contents
 * @returns Layer that provides a FileSystem service backed by memory
 *
 * @example
 * ```ts
 * import { Fs } from '@wollybeard/kit'
 * import { FileSystem } from '@effect/platform'
 * import { Effect } from 'effect'
 *
 * const diskLayout = {
 *   '/config.json': '{"name": "test"}',
 *   '/src/index.js': 'export const x = 1'
 * }
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystem.FileSystem
 *   const content = yield* fs.readFileString('/config.json')
 *   console.log(content) // {"name": "test"}
 * })
 *
 * Effect.runPromise(
 *   Effect.provide(program, Fs.Memory.layer(diskLayout))
 * )
 * ```
 */
export const layer = (initialDiskLayout: DiskLayout) => {
  // Create mutable copy of disk layout for write operations
  const diskLayout: DiskLayout = { ...initialDiskLayout }

  return Layer.succeed(FileSystem, {
    // File existence check
    exists: (path: string) => {
      // Check if path exists directly
      if (path in diskLayout) return Effect.succeed(true)

      // Check if it's a directory with marker
      const dirPath = path.endsWith('/') ? path : path + '/'
      if (`${dirPath}.dir_marker` in diskLayout) return Effect.succeed(true)

      // Check if it's a directory with files under it
      const normalizedPath = path.endsWith('/') ? path : path + '/'
      const hasChildren = Object.keys(diskLayout).some(
        (key) => key.startsWith(normalizedPath) && key !== path,
      )

      return Effect.succeed(hasChildren)
    },

    // Read file as string
    readFileString: (path: string) => {
      const content = diskLayout[path]
      if (content !== undefined) {
        return Effect.succeed(
          typeof content === 'string' ? content : new TextDecoder().decode(content),
        )
      }
      return failNotFound('readFileString', path, 'open')
    },

    // Read directory contents
    readDirectory: (path: string) => {
      const normalizedPath = path.endsWith('/') ? path : path + '/'
      const entries = Object.keys(diskLayout)
        .filter((filePath) => filePath.startsWith(normalizedPath))
        .map((filePath) => filePath.slice(normalizedPath.length))
        .filter((relativePath) => relativePath.length > 0 && !relativePath.includes('/'))
        .filter((entry) => !entry.endsWith('.dir_marker')) // Filter out directory markers

      // Check if directory exists (has marker or files)
      const dirExists = `${normalizedPath}.dir_marker` in diskLayout || entries.length > 0

      return dirExists ? Effect.succeed(entries) : failNotFound('readDirectory', path, 'scandir')
    },

    // File stats (simplified - just checks existence)
    stat: (path: string) => {
      if (path in diskLayout) {
        const content = diskLayout[path]!
        return Effect.succeed({
          type: 'File' as const,
          isFile: () => true,
          isDirectory: () => false,
          isSymbolicLink: () => false,
          size: typeof content === 'string' ? content.length : content.byteLength,
        } as any)
      }

      // Check if it's a directory with marker
      const dirPath = path.endsWith('/') ? path : path + '/'
      if (`${dirPath}.dir_marker` in diskLayout) {
        return Effect.succeed({
          type: 'Directory' as const,
          isFile: () => false,
          isDirectory: () => true,
          isSymbolicLink: () => false,
          size: 0,
        } as any)
      }

      // Check if it's a directory (has files under it)
      const normalizedPath = path.endsWith('/') ? path : path + '/'
      const hasChildren = Object.keys(diskLayout).some(
        (filePath) => filePath.startsWith(normalizedPath) && filePath !== path,
      )

      if (hasChildren || normalizedPath === '/') {
        return Effect.succeed({
          type: 'Directory' as const,
          isFile: () => false,
          isDirectory: () => true,
          isSymbolicLink: () => false,
          size: 0,
        } as any)
      }

      return failNotFound('stat', path, 'stat')
    },

    // Write operations
    writeFileString: (path: string, content: string) => {
      diskLayout[path] = content
      return Effect.void
    },

    writeFile: (path: string, content: Uint8Array) => {
      diskLayout[path] = content
      return Effect.void
    },

    truncate: (path: string) => {
      if (path in diskLayout) {
        diskLayout[path] = ''
        return Effect.void
      }
      return failNotFound('truncate', path, 'truncate')
    },

    remove: (path: string, options?: { recursive?: boolean }) => {
      if (options?.recursive) {
        // Remove all files under this path
        const normalizedPath = path.endsWith('/') ? path : path + '/'
        Object.keys(diskLayout).forEach((key) => {
          if (key === path || key.startsWith(normalizedPath)) {
            delete diskLayout[key]
          }
        })
      } else {
        delete diskLayout[path]
      }
      return Effect.void
    },

    makeDirectory: (path: string, options?: { recursive?: boolean }) => {
      // Track empty directories by adding a marker
      // This allows exists() to find them
      if (!path.endsWith('/')) {
        path = path + '/'
      }
      // Add a special marker for the directory
      diskLayout[`${path}.dir_marker`] = ''
      return Effect.void
    },
    makeTempDirectory: () => failUnsupported('makeTempDirectory', 'Write operations'),
    makeTempDirectoryScoped: () => failUnsupported('makeTempDirectoryScoped', 'Write operations'),
    makeTempFile: () => failUnsupported('makeTempFile', 'Write operations'),
    makeTempFileScoped: () => failUnsupported('makeTempFileScoped', 'Write operations'),
    open: () => failUnsupported('open', 'File operations'),
    copy: (oldPath: string, newPath: string) => {
      const content = diskLayout[oldPath]
      if (content !== undefined) {
        diskLayout[newPath] = content
        return Effect.void
      }
      return failNotFound('copy', oldPath, 'copy')
    },
    copyFile: (oldPath: string, newPath: string) => {
      const content = diskLayout[oldPath]
      if (content !== undefined) {
        diskLayout[newPath] = content
        return Effect.void
      }
      return failNotFound('copyFile', oldPath, 'copy')
    },
    chmod: () => Effect.void,
    chown: () => Effect.void,
    access: (path: string) =>
      path in diskLayout ? Effect.void : failNotFound('access', path, 'access'),
    link: (oldPath: string, newPath: string) => {
      const content = diskLayout[oldPath]
      if (content !== undefined) {
        diskLayout[newPath] = content
        return Effect.void
      }
      return failNotFound('link', oldPath, 'link')
    },
    realPath: (path: string) => Effect.succeed(path),
    readFile: (path: string) => {
      const content = diskLayout[path]
      if (content !== undefined) {
        return Effect.succeed(
          typeof content === 'string' ? new TextEncoder().encode(content) : content,
        )
      }
      return failNotFound('readFile', path, 'open')
    },
    readLink: (path: string) => Effect.succeed(path),
    symlink: (target: string, path: string) => {
      // For simplicity, just copy the content
      const content = diskLayout[target]
      if (content !== undefined) {
        diskLayout[path] = content
      }
      return Effect.void
    },
    utimes: () => Effect.void,
    watch: () => failUnsupported('watch', 'Watch operations'),

    // Rename/move files
    rename: (oldPath: string, newPath: string) => {
      const content = diskLayout[oldPath]
      if (content !== undefined) {
        diskLayout[newPath] = content
        delete diskLayout[oldPath]
        return Effect.void
      }
      return failNotFound('rename', oldPath, 'rename')
    },

    // Create writable sink (not implemented for memory filesystem)
    sink: () => failUnsupported('sink', 'Stream operations'),

    // Create readable stream (not implemented for memory filesystem)
    stream: () => failUnsupported('stream', 'Stream operations'),
  })
}

/**
 * Convenience function for creating memory filesystem layers from disk layout.
 * Alias for {@link layer} to match common naming patterns.
 *
 * @param diskLayout - Object mapping file paths to their contents
 * @returns Layer that provides an Effect Platform FileSystem service backed by memory
 *
 * @example
 * ```ts
 * import { Fs } from '@wollybeard/kit'
 *
 * const testFs = Fs.Memory.layerFromDiskLayout({
 *   '/package.json': '{"name": "test-project"}',
 *   '/src/index.js': 'export default "hello"'
 * })
 * ```
 */
export const layerFromDiskLayout = (diskLayout: DiskLayout) => layer(diskLayout)
