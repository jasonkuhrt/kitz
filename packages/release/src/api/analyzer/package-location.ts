import { Fs } from '@kitz/fs'

export interface PackageLocation {
  readonly path: Fs.Path.AbsDir
  readonly relativePath: Fs.Path.RelDir
}

export interface PackageSourceUrlParams {
  readonly owner: string
  readonly repo: string
  readonly branch: string
}

const normalizeAbsoluteDir = (path: Fs.Path.AbsDir): string =>
  Fs.Path.toString(path).replace(/\\/gu, '/').replace(/\/+$/u, '')

const normalizeRelativeDir = (path: Fs.Path.RelDir | string): string =>
  (typeof path === 'string' ? path : Fs.Path.RelDir.toString(path))
    .replace(/\\/gu, '/')
    .replace(/^\.\//u, '')
    .replace(/\/+$/u, '')

export namespace PackageLocation {
  export const fromAbsolutePath = (root: Fs.Path.AbsDir, path: Fs.Path.AbsDir): PackageLocation => {
    const normalizedRoot = normalizeAbsoluteDir(root)
    const normalizedPath = normalizeAbsoluteDir(path)
    const rootPrefix = `${normalizedRoot}/`

    if (!normalizedPath.startsWith(rootPrefix)) {
      throw new TypeError(
        `Package path "${normalizedPath}/" is not inside repo root "${normalizedRoot}/".`,
      )
    }

    const relativePath = normalizedPath.slice(rootPrefix.length)
    if (relativePath.length === 0) {
      throw new TypeError(`Package path "${normalizedPath}/" cannot be the repo root itself.`)
    }

    return {
      path,
      relativePath: Fs.Path.RelDir.fromString(`./${relativePath}/`),
    }
  }

  export const inferDefault = (root: Fs.Path.AbsDir, scope: string): PackageLocation => {
    const relativePath = Fs.Path.RelDir.fromString(`./packages/${scope}/`)

    return {
      path: Fs.Path.join(root, relativePath),
      relativePath,
    }
  }

  export const toRelativePathString = (location: PackageLocation): string =>
    normalizeRelativeDir(location.relativePath)

  export const containsRepoPath = (
    location: PackageLocation,
    repoRelativePath: string,
  ): boolean => {
    const normalizedPath = repoRelativePath.replace(/\\/gu, '/').replace(/^\.\/+/u, '')
    const relativePath = toRelativePathString(location)

    return normalizedPath === relativePath || normalizedPath.startsWith(`${relativePath}/`)
  }

  export const toSourceUrl = (location: PackageLocation, params: PackageSourceUrlParams): string =>
    `https://github.com/${params.owner}/${params.repo}/tree/${params.branch}/${toRelativePathString(location)}`
}
