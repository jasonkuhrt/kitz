import { Moniker } from '#moniker'
import { Range as SemverRange } from '#range'
import { Semver } from '@kitz/semver'
import { Effect, Option, SchemaGetter, SchemaIssue, Schema as S } from 'effect'
import { SemverFromString, SemverSelf } from '../semver-schema.js'

// ============================================================================
// Type-Level Parsing
// ============================================================================

/**
 * Extract specifier from "name@specifier" string at type level.
 * Handles scoped (@scope/name@spec) and unscoped (name@spec) packages.
 */
// oxfmt-ignore
type ExtractSpecifier<$S extends string> =
  // Scoped: @scope/name@specifier
  $S extends `@${string}/${infer $Rest}`
    ? $Rest extends `${string}@${infer $Spec}` ? $Spec : never :
  // Unscoped: name@specifier
  $S extends `${string}@${infer $Spec}` ? $Spec :
  never

/**
 * Detect if specifier has range operators (excludes exact versions).
 */
// oxfmt-ignore
type HasRangeOperators<$S extends string> =
  $S extends `^${string}`         ? true :
  $S extends `~${string}`         ? true :
  $S extends `>${string}`         ? true :
  $S extends `<${string}`         ? true :
  $S extends `=${string}`         ? true :
  $S extends '*'                  ? true :
  $S extends 'x'                  ? true :
  $S extends `${string}x${string}` ? true :  // wildcards like 1.x
  $S extends `${string}X${string}` ? true :
  $S extends `${string}*${string}` ? true :
  $S extends `${string} ${string}` ? true :  // space = multiple parts (OR, hyphen range)
  $S extends `${string}||${string}` ? true : // OR
  false

/**
 * Detect if specifier looks like an exact semver version.
 * Starts with digit, no range operators.
 */
// oxfmt-ignore
type IsExactVersion<$S extends string> =
  $S extends `${number}${string}`
    ? HasRangeOperators<$S> extends true ? false : true
    : false

/**
 * Parse a pin string to its variant type at compile time.
 *
 * - `workspace:*` → Workspace
 * - `git+...` or `github:...` → Git
 * - `file:...` → Path
 * - `https://...` or `http://...` → Url
 * - `npm:...` → Alias
 * - Exact version (`1.0.0`, `2.0.0-beta.1`) → Exact
 * - Range-like (`^`, `~`, `>=`, `*`, `1.x`) → Range
 * - Otherwise → Tag
 */
// oxfmt-ignore
type ParsePin<$S extends string> =
  string extends $S ? Pin :
  ExtractSpecifier<$S> extends infer $Spec extends string
    ? $Spec extends `workspace:${string}` ? Workspace :
      $Spec extends `git+${string}`       ? Git :
      $Spec extends `github:${string}`    ? Git :
      $Spec extends `file:${string}`      ? Path :
      $Spec extends `https://${string}`   ? Url :
      $Spec extends `http://${string}`    ? Url :
      $Spec extends `npm:${string}`       ? Alias :
      IsExactVersion<$Spec> extends true  ? Exact :
      HasRangeOperators<$Spec> extends true ? Range :
      $Spec extends `${number}${string}`  ? Range : // fallback for digit-start
                                            Tag
    : never

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Workspace protocol version specifier.
 *
 * Special tokens that resolve at publish time:
 * - `*` - Use exact workspace version (e.g., `1.0.0`)
 * - `^` - Use caret range of workspace version (e.g., `^1.0.0`)
 * - `~` - Use tilde range of workspace version (e.g., `~1.0.0`)
 *
 * Can also be a full semver range for more control.
 *
 * Note: `^` and `~` alone are NOT valid semver ranges. They are
 * workspace-specific resolution tokens that get expanded at publish time.
 *
 * @see {@link https://bun.sh/docs/install/workspaces | Bun workspaces}
 * @see {@link https://yarnpkg.com/features/workspaces#publishing-workspaces | Yarn workspace protocol}
 */
export type WorkspaceRange = '*' | '^' | '~' | SemverRange.Range

export const WorkspaceRange: S.Codec<WorkspaceRange, string> = S.Union([
  S.Literal('*'),
  S.Literal('^'),
  S.Literal('~'),
  SemverRange.Schema,
])

/**
 * npm dist-tag name.
 *
 * Common tags: `latest`, `next`, `beta`, `canary`, `rc`
 *
 * @see {@link https://docs.npmjs.com/cli/v10/commands/npm-dist-tag | npm dist-tag command}
 */
export const DistTag = S.NonEmptyString.pipe(S.brand('DistTag'))
export type DistTag = typeof DistTag.Type

// ============================================================================
// Pin Variants
// ============================================================================

/**
 * Semver range dependency: `@scope/pkg@^1.0.0`
 *
 * The most common dependency type. Specifies a version range that
 * npm will resolve to the highest matching published version.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies | npm dependencies}
 */
class RangeClass extends S.TaggedClass<RangeClass>()('PinRange', {
  name: Moniker.FromString,
  range: SemverRange.Schema,
}) {
  static decode = Schema.decode(RangeClass)
  static decodeSync = Schema.decodeSync(RangeClass)
  static encode = Schema.encode(RangeClass)
  static encodeSync = Schema.encodeSync(RangeClass)
  static equivalence = Schema.equivalence(RangeClass)
  static ordered = false as const
  static make = this.makeUnsafe
  static is = S.is(RangeClass)

  /**
   * Parse a range pin from string.
   *
   * @example
   * ```ts
   * const pin = Range.fromString('@kitz/core@^1.0.0')
   * //    ^? Range
   * ```
   */
  static fromString = (input: string): RangeClass => {
    const { name, specifier } = splitNameSpecifier(input)
    return RangeClass.make({
      name: Moniker.parse(name),
      range: SemverRange.fromString(specifier),
    })
  }
}

export const Range: typeof RangeClass = RangeClass
export type Range = RangeClass

/**
 * Exact version dependency: `@scope/pkg@1.0.0`
 *
 * Pins to a specific version with no flexibility. Unlike Range which
 * may resolve to different versions over time, Exact always resolves
 * to the specified version.
 *
 * Also used for release tags: git tags like `@kitz/core@1.0.0` that
 * mark specific releases.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies | npm dependencies}
 */
export type Exact = ExactClass

class ExactClass extends S.TaggedClass<ExactClass>()('PinExact', {
  name: Moniker.FromString,
  version: SemverSelf,
}) {
  static decode = Schema.decode(ExactClass)
  static decodeSync = Schema.decodeSync(ExactClass)
  static encode = Schema.encode(ExactClass)
  static encodeSync = Schema.encodeSync(ExactClass)
  static equivalence = Schema.equivalence(ExactClass)
  static ordered = false as const
  static make = this.makeUnsafe
  static is = S.is(ExactClass)

  /**
   * String codec for exact pins.
   *
   * Parses `<name>@<semver>` strings into {@link Exact}.
   */
  static FromString: S.Codec<Exact, string> = S.String.pipe(
    S.decodeTo(ExactClass, {
      decode: SchemaGetter.transformOrFail((value) => {
        const atIndex = value.lastIndexOf('@')
        if (atIndex <= 0 || atIndex >= value.length - 1) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(value), {
              message: `Invalid exact pin: expected '<name>@<version>'`,
            }),
          )
        }

        const name = S.decodeUnknownOption(Moniker.FromString)(value.slice(0, atIndex))
        if (Option.isNone(name)) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(value), {
              message: `Invalid package name in exact pin`,
            }),
          )
        }

        const version = S.decodeUnknownOption(SemverFromString)(value.slice(atIndex + 1))
        if (Option.isNone(version)) {
          return Effect.fail(
            new SchemaIssue.InvalidValue(Option.some(value), {
              message: `Invalid semver in exact pin`,
            }),
          )
        }

        return Effect.succeed({
          _tag: 'PinExact' as const,
          name: name.value.moniker,
          version: version.value,
        })
      }),
      encode: SchemaGetter.transform((pin) => `${pin.name}@${Semver.toString(pin.version)}`),
    }),
  )

  /**
   * Parse an exact pin from string.
   *
   * @example
   * ```ts
   * const pin = Exact.fromString('@kitz/core@1.0.0')
   * //    ^? Exact
   * ```
   */
  static fromString = S.decodeSync(ExactClass.FromString)
}

export const Exact: typeof ExactClass = ExactClass

/**
 * Dist-tag dependency: `lodash@latest`
 *
 * References a named version tag rather than a semver range.
 * Tags are mutable pointers managed by `npm dist-tag`.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/commands/npm-dist-tag | npm dist-tag command}
 */
export class Tag extends S.TaggedClass<Tag>()('PinTag', {
  name: Moniker.FromString,
  tag: DistTag,
}) {
  static decode = Schema.decode(Tag)
  static decodeSync = Schema.decodeSync(Tag)
  static encode = Schema.encode(Tag)
  static encodeSync = Schema.encodeSync(Tag)
  static equivalence = Schema.equivalence(Tag)
  static ordered = false as const
  static make = this.makeUnsafe
  static is = S.is(Tag)

  /**
   * Parse a tag pin from string.
   *
   * @example
   * ```ts
   * const pin = Tag.fromString('lodash@latest')
   * //    ^? Tag
   * ```
   */
  static fromString = (input: string): Tag => {
    const { name, specifier } = splitNameSpecifier(input)
    return Tag.make({
      name: Moniker.parse(name),
      tag: S.decodeSync(DistTag)(specifier),
    })
  }
}

/**
 * Workspace protocol dependency: `@internal/util@workspace:*`
 *
 * References a package in the same monorepo workspace.
 * The specifier is resolved at publish time to an actual version.
 *
 * @see {@link https://bun.sh/docs/install/workspaces | Bun workspaces}
 * @see {@link https://yarnpkg.com/features/workspaces#publishing-workspaces | Yarn workspace protocol}
 */
class WorkspaceClass extends S.TaggedClass<WorkspaceClass>()('PinWorkspace', {
  name: Moniker.FromString,
  range: WorkspaceRange,
}) {
  static decode = Schema.decode(WorkspaceClass)
  static decodeSync = Schema.decodeSync(WorkspaceClass)
  static encode = Schema.encode(WorkspaceClass)
  static encodeSync = Schema.encodeSync(WorkspaceClass)
  static equivalence = Schema.equivalence(WorkspaceClass)
  static ordered = false as const
  static make = this.makeUnsafe
  static is = S.is(WorkspaceClass)

  /**
   * Parse a workspace pin from string.
   *
   * @example
   * ```ts
   * const pin = Workspace.fromString('@internal/util@workspace:*')
   * //    ^? Workspace
   * ```
   */
  static fromString = (input: string): WorkspaceClass => {
    const { name, specifier } = splitNameSpecifier(input)
    const workspaceRange = specifier.replace(/^workspace:/, '')
    return WorkspaceClass.make({
      name: Moniker.parse(name),
      range: parseWorkspaceRange(workspaceRange),
    })
  }
}

export const Workspace: typeof WorkspaceClass = WorkspaceClass
export type Workspace = WorkspaceClass

/**
 * Git repository dependency: `pkg@git+https://github.com/org/repo#v1.0.0`
 *
 * Installs directly from a git repository. Supports:
 * - HTTPS: `git+https://github.com/org/repo.git`
 * - SSH: `git+ssh://git@github.com:org/repo.git`
 * - GitHub shorthand: `github:org/repo`
 *
 * Fragment (#) specifies commit, tag, or branch.
 * Can include `#semver:^1.0.0` for semver-based resolution.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#git-urls-as-dependencies | npm git URLs}
 */
class GitClass extends S.TaggedClass<GitClass>()('PinGit', {
  name: Moniker.FromString,
  /** Full git URL including protocol. */
  url: S.String,
  /** Git ref: branch, tag, or commit SHA. */
  ref: S.OptionFromUndefinedOr(S.String),
  /** Semver range for git tags (used with #semver: fragment). */
  semver: S.OptionFromUndefinedOr(SemverRange.Schema),
}) {
  static decode = Schema.decode(GitClass)
  static decodeSync = Schema.decodeSync(GitClass)
  static encode = Schema.encode(GitClass)
  static encodeSync = Schema.encodeSync(GitClass)
  static equivalence = Schema.equivalence(GitClass)
  static ordered = false as const
  static make = this.makeUnsafe
  static is = S.is(GitClass)

  /**
   * Parse a git pin from string.
   *
   * @example
   * ```ts
   * const pin = Git.fromString('my-pkg@git+https://github.com/org/repo#v1.0.0')
   * //    ^? Git
   * ```
   */
  static fromString = (input: string): GitClass => {
    const { name, specifier } = splitNameSpecifier(input)
    const { url, ref, semver } = parseGitUrl(specifier)
    return GitClass.make({
      name: Moniker.parse(name),
      url,
      ref,
      semver,
    })
  }
}

export const Git: typeof GitClass = GitClass
export type Git = GitClass

/**
 * Local path dependency: `pkg@file:../local-pkg`
 *
 * References a package on the local filesystem. Path is relative
 * to the package.json containing the dependency.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#local-paths | npm local paths}
 */
export class Path extends S.TaggedClass<Path>()('PinPath', {
  name: Moniker.FromString,
  /** Relative or absolute filesystem path. */
  path: S.String,
}) {
  static decode = Schema.decode(Path)
  static decodeSync = Schema.decodeSync(Path)
  static encode = Schema.encode(Path)
  static encodeSync = Schema.encodeSync(Path)
  static equivalence = Schema.equivalence(Path)
  static ordered = false as const
  static make = this.makeUnsafe
  static is = S.is(Path)

  /**
   * Parse a path pin from string.
   *
   * @example
   * ```ts
   * const pin = Path.fromString('my-pkg@file:../shared')
   * //    ^? Path
   * ```
   */
  static fromString = (input: string): Path => {
    const { name, specifier } = splitNameSpecifier(input)
    return Path.make({
      name: Moniker.parse(name),
      path: specifier.replace(/^file:/, ''),
    })
  }
}

/**
 * Tarball URL dependency: `pkg@https://example.com/pkg-1.0.0.tgz`
 *
 * Installs from a remote tarball URL. Must be a valid URL
 * pointing to a `.tgz` or `.tar.gz` file.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#urls-as-dependencies | npm URLs}
 */
export class Url extends S.TaggedClass<Url>()('PinUrl', {
  name: Moniker.FromString,
  /** Full URL to the tarball. */
  url: S.String,
}) {
  static decode = Schema.decode(Url)
  static decodeSync = Schema.decodeSync(Url)
  static encode = Schema.encode(Url)
  static encodeSync = Schema.encodeSync(Url)
  static equivalence = Schema.equivalence(Url)
  static ordered = false as const
  static make = this.makeUnsafe
  static is = S.is(Url)

  /**
   * Parse a URL pin from string.
   *
   * @example
   * ```ts
   * const pin = Url.fromString('my-pkg@https://example.com/pkg.tgz')
   * //    ^? Url
   * ```
   */
  static fromString = (input: string): Url => {
    const { name, specifier } = splitNameSpecifier(input)
    return Url.make({
      name: Moniker.parse(name),
      url: specifier,
    })
  }
}

/**
 * Package alias: `my-lodash@npm:lodash@^4.0.0`
 *
 * Allows installing a package under a different name. Useful for:
 * - Installing multiple versions of the same package
 * - Renaming packages for clarity
 * - Replacing packages with compatible alternatives
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#npm-aliases | npm aliases}
 */
export class Alias extends S.TaggedClass<Alias>()('PinAlias', {
  /** The alias name (what you import as). */
  name: Moniker.FromString,
  /** The actual package being installed. */
  target: Moniker.FromString,
  /** Version specifier for the target package (range or tag). */
  targetSpecifier: S.String,
}) {
  static decode = Schema.decode(Alias)
  static decodeSync = Schema.decodeSync(Alias)
  static encode = Schema.encode(Alias)
  static encodeSync = Schema.encodeSync(Alias)
  static equivalence = Schema.equivalence(Alias)
  static ordered = false as const
  static make = this.makeUnsafe
  static is = S.is(Alias)

  /**
   * Parse an alias pin from string.
   *
   * @example
   * ```ts
   * const pin = Alias.fromString('my-lodash@npm:lodash@^4.0.0')
   * //    ^? Alias
   * ```
   */
  static fromString = (input: string): Alias => {
    const { name, specifier } = splitNameSpecifier(input)
    // specifier is like "npm:lodash@^4.0.0" or "npm:@scope/pkg@^1.0.0"
    const npmPart = specifier.replace(/^npm:/, '')
    const { name: targetName, specifier: targetSpec } = splitNameSpecifier(npmPart)
    return Alias.make({
      name: Moniker.parse(name),
      target: Moniker.parse(targetName),
      targetSpecifier: targetSpec,
    })
  }
}

// ============================================================================
// Pin Union
// ============================================================================

/**
 * Package dependency specifier union.
 *
 * Represents any valid dependency format from package.json.
 * Use {@link fromString} for type-safe parsing.
 *
 * Tagged union with `.guards`, `.match`, `.cases`, and `.isAnyOf` utilities.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies | npm dependencies}
 */
export const Pin = S.Union([Range, Exact, Tag, Workspace, Git, Path, Url, Alias]).pipe(
  S.toTaggedUnion('_tag'),
)
export type Pin = typeof Pin.Type

export namespace Pin {
  export type Range = import('./pin.js').Range
  export type Exact = import('./pin.js').Exact
  export type Tag = import('./pin.js').Tag
  export type Workspace = import('./pin.js').Workspace
  export type Git = import('./pin.js').Git
  export type Path = import('./pin.js').Path
  export type Url = import('./pin.js').Url
  export type Alias = import('./pin.js').Alias
}

/**
 * Type guard for Pin union.
 */
export const is = S.is(Pin)

// ============================================================================
// Root Dispatcher
// ============================================================================

/**
 * Parse any pin from string with automatic variant detection.
 *
 * This is a thin dispatcher that:
 * 1. Detects the specifier type from the input
 * 2. Delegates to the appropriate variant's `fromString`
 *
 * Use this when you don't know the variant ahead of time.
 * Use variant-specific `Range.fromString`, `Tag.fromString`, etc.
 * when you already know the type.
 *
 * @example
 * ```ts
 * // Unknown variant - dispatches based on input
 * const a = Pin.fromString('@kitz/core@^1.0.0')
 * // Range { name: Scoped, range: SemverRange }
 *
 * const b = Pin.fromString('lodash@latest')
 * // Tag { name: Unscoped, tag: 'latest' }
 *
 * const c = Pin.fromString('@internal/util@workspace:*')
 * // Workspace { name: Scoped, range: '*' }
 *
 * // Known variant - use directly for clarity
 * const d = Range.fromString('@kitz/core@^1.0.0')
 * const e = Tag.fromString('lodash@latest')
 * ```
 */
export function fromString<const $S extends string>(input: $S): ParsePin<$S>
export function fromString(input: string): Pin
export function fromString(input: string): Pin {
  const { specifier } = splitNameSpecifier(input)

  if (specifier.startsWith('workspace:')) {
    return Workspace.fromString(input)
  }
  if (specifier.startsWith('git+') || specifier.startsWith('github:')) {
    return Git.fromString(input)
  }
  if (specifier.startsWith('file:')) {
    return Path.fromString(input)
  }
  if (specifier.startsWith('https://') || specifier.startsWith('http://')) {
    return Url.fromString(input)
  }
  if (specifier.startsWith('npm:')) {
    return Alias.fromString(input)
  }
  if (isExactVersion(specifier)) {
    return Exact.fromString(input)
  }
  if (isRangeLike(specifier)) {
    return Range.fromString(input)
  }
  return Tag.fromString(input)
}

/**
 * Decode a string literal to a specific Pin variant type.
 *
 * Use this when you want explicit "literal parser" semantics,
 * matching the path module style.
 */
export const fromLiteral = <const $S extends string>(input: $S): ParsePin<$S> => fromString(input)

// ============================================================================
// Pattern Matching Helper
// ============================================================================

/**
 * Exhaustively pattern match on a Pin variant.
 *
 * Delegates to `Pin.match` from the tagged union.
 *
 * @example
 * ```ts
 * const description = match(pin, {
 *   PinRange: (p) => `${monikerToString(p.name)} @ ${p.range.toString()}`,
 *   PinExact: (p) => `${monikerToString(p.name)} @ ${p.version.version.toString()}`,
 *   PinTag: (p) => `${monikerToString(p.name)} @ dist-tag ${p.tag}`,
 *   PinWorkspace: (p) => `${monikerToString(p.name)} (workspace)`,
 *   PinGit: (p) => `${monikerToString(p.name)} from git`,
 *   PinPath: (p) => `${monikerToString(p.name)} from ${p.path}`,
 *   PinUrl: (p) => `${monikerToString(p.name)} from URL`,
 *   PinAlias: (p) => `${monikerToString(p.name)} → ${monikerToString(p.target)}`,
 * })
 * ```
 */
export const match: typeof Pin.match = Pin.match

// ============================================================================
// String Codec
// ============================================================================

/**
 * Encode a Pin back to its string representation.
 *
 * @example
 * ```ts
 * const pin = Range.fromString('@kitz/core@^1.0.0')
 * const str = toString(pin)
 * // '@kitz/core@^1.0.0'
 * ```
 */
export const toString = (pin: Pin): string =>
  match(pin, {
    PinRange: (p) => `${monikerToString(p.name)}@${SemverRange.toString(p.range)}`,
    PinExact: (p) => `${monikerToString(p.name)}@${Semver.toString(p.version)}`,
    PinTag: (p) => `${monikerToString(p.name)}@${p.tag}`,
    PinWorkspace: (p) => {
      const rangeStr = typeof p.range === 'string' ? p.range : SemverRange.toString(p.range)
      return `${monikerToString(p.name)}@workspace:${rangeStr}`
    },
    PinGit: (p) => {
      let result = `${monikerToString(p.name)}@${p.url}`
      if (p.semver._tag === 'Some') {
        result += `#semver:${SemverRange.toString(p.semver.value)}`
      } else if (p.ref._tag === 'Some') {
        result += `#${p.ref.value}`
      }
      return result
    },
    PinPath: (p) => `${monikerToString(p.name)}@file:${p.path}`,
    PinUrl: (p) => `${monikerToString(p.name)}@${p.url}`,
    PinAlias: (p) =>
      `${monikerToString(p.name)}@npm:${monikerToString(p.target)}@${p.targetSpecifier}`,
  })

/**
 * Render a raw workspace protocol dependency specifier into the form that
 * should appear in a published package manifest.
 *
 * The workspace parser is still used to validate that the specifier is really
 * a workspace pin for the given package, but the original raw range text is
 * preserved so explicit ranges keep their authored spelling.
 */
export function workspaceSpecifierToPublished(
  packageName: string,
  specifier: string,
  version: Semver.Semver,
): string {
  const pin = fromString(`${packageName}@${specifier}`)
  if (!Workspace.is(pin)) {
    throw new Error(`Expected workspace protocol dependency for ${packageName}, got ${specifier}`)
  }

  const rawRange = specifier.replace(/^workspace:/u, '')
  if (rawRange === '*') return Semver.toString(version)
  if (rawRange === '^') return `^${Semver.toString(version)}`
  if (rawRange === '~') return `~${Semver.toString(version)}`
  return rawRange
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Convert a Moniker to its string representation.
 */
const monikerToString = (moniker: Moniker.Moniker): string => moniker.moniker

/**
 * Split "name@specifier" into parts, handling scoped packages.
 */
const splitNameSpecifier = (input: string): { name: string; specifier: string } => {
  // Handle scoped packages: @scope/name@specifier
  if (input.startsWith('@')) {
    const slashIndex = input.indexOf('/')
    if (slashIndex === -1) {
      throw new Error(`Invalid scoped package: ${input}`)
    }
    const afterSlash = input.slice(slashIndex + 1)
    const atIndex = afterSlash.indexOf('@')
    if (atIndex === -1) {
      throw new Error(`Missing specifier in: ${input}`)
    }
    const name = input.slice(0, slashIndex + 1 + atIndex)
    const specifier = afterSlash.slice(atIndex + 1)
    return { name, specifier }
  }

  // Unscoped: name@specifier
  const atIndex = input.indexOf('@')
  if (atIndex === -1) {
    throw new Error(`Missing specifier in: ${input}`)
  }
  return {
    name: input.slice(0, atIndex),
    specifier: input.slice(atIndex + 1),
  }
}

/**
 * Check if a specifier has range operators.
 */
const hasRangeOperators = (specifier: string): boolean => {
  return (
    specifier.startsWith('^') ||
    specifier.startsWith('~') ||
    specifier.startsWith('>') ||
    specifier.startsWith('<') ||
    specifier.startsWith('=') ||
    specifier === '*' ||
    specifier === 'x' ||
    specifier.includes(' ') || // hyphen range or OR
    specifier.includes('||') ||
    /[xX*]/.test(specifier.slice(1)) // wildcards like 1.x, 1.X, 1.*
  )
}

/**
 * Check if a specifier is an exact semver version.
 * Starts with digit, no range operators.
 */
const isExactVersion = (specifier: string): boolean => {
  if (!/^\d/.test(specifier)) return false
  if (hasRangeOperators(specifier)) return false
  return Option.isSome(S.decodeUnknownOption(SemverFromString)(specifier))
}

/**
 * Check if a specifier looks like a semver range (not exact).
 */
const isRangeLike = (specifier: string): boolean => {
  if (hasRangeOperators(specifier)) return true
  // Starts with digit but is not exact (e.g., "1" without minor/patch)
  return /^\d/.test(specifier) && !isExactVersion(specifier)
}

/**
 * Parse workspace range specifier.
 */
const parseWorkspaceRange = (range: string): WorkspaceRange => {
  if (range === '*' || range === '^' || range === '~') {
    return range
  }
  return SemverRange.fromString(range)
}

/**
 * Parse git URL into components.
 */
const parseGitUrl = (
  specifier: string,
): {
  url: string
  ref: Option.Option<string>
  semver: Option.Option<SemverRange.Range>
} => {
  const hashIndex = specifier.indexOf('#')
  if (hashIndex === -1) {
    return { url: specifier, ref: Option.none(), semver: Option.none() }
  }

  const url = specifier.slice(0, hashIndex)
  const fragment = specifier.slice(hashIndex + 1)

  if (fragment.startsWith('semver:')) {
    const range = fragment.slice('semver:'.length)
    return {
      url,
      ref: Option.none(),
      semver: Option.some(SemverRange.fromString(range)),
    }
  }

  return { url, ref: Option.some(fragment), semver: Option.none() }
}
