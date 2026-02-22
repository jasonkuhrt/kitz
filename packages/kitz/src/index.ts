/**
 * kitz - A TypeScript standard library.
 *
 * This is the main entry point that re-exports all namespaces from all packages.
 *
 * @example
 * ```ts
 * import { Arr, Str, Obj, Fn, Fs, Cli } from 'kitz'
 *
 * const result = Arr.map([1, 2, 3], n => n * 2)
 * ```
 *
 * @packageDocumentation
 */

// Core package namespaces
export * from '@kitz/core'

// Regular package namespaces
export { Assert } from '@kitz/assert'
export { Bldr } from '@kitz/bldr'
export { Cli } from '@kitz/cli'
export { Color } from '@kitz/color'
export { Conf } from '@kitz/conf'
export { Env } from '@kitz/env'
export { Fs } from '@kitz/fs'
export { Group } from '@kitz/group'
export { Html } from '@kitz/html'
export { Http } from '@kitz/http'
export { Idx } from '@kitz/idx'
export { Json } from '@kitz/json'
export { Jsonc } from '@kitz/jsonc'
export { Log } from '@kitz/log'
// export { Mask } from '@kitz/mask'
export { Mod } from '@kitz/mod'
export { Monorepo } from '@kitz/monorepo'
export { Name } from '@kitz/name'
export { Num as ExtNum } from '@kitz/num'
export { Oak } from '@kitz/oak'
export { Paka } from '@kitz/paka'
export { Pkg } from '@kitz/pkg'
export { Resource } from '@kitz/resource'
export { Sch } from '@kitz/sch'
export { Semver } from '@kitz/semver'
export { Syn } from '@kitz/syn'
export { Test } from '@kitz/test'
export { Tex } from '@kitz/tex'
export { Tree } from '@kitz/tree'
export { Url } from '@kitz/url'
export { Ware } from '@kitz/ware'
