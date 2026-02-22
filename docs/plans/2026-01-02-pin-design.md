# Pin: Package Dependency Specifier Schema

**Date:** 2026-01-02
**Package:** `@kitz/pkg`
**Status:** Design

## Overview

A `Pin` represents a package dependency specifier as found in `package.json` dependencies. It combines a package name with a version specifier, supporting all npm dependency formats.

Unlike `Semver` (which is language-agnostic), `Pin` is npm/package.json-specific and captures the full range of dependency specification syntax.

## Motivation

Current code uses string concatenation for package@version patterns:

```typescript
b`  - Publish ${r.package.name}@${Api.Plan.getNextVersion(r).version}`
```

This lacks:

- Type safety for the combined format
- Schema validation
- Structured access to components
- Support for range expressions (`^`, `~`, etc.)

## Design

### Pin Variants

Pin is a tagged class union covering all npm dependency specifier forms:

| Variant     | Example                                  | Description                  |
| ----------- | ---------------------------------------- | ---------------------------- |
| `Range`     | `@kitz/core@^1.0.0`                      | Semver range expression      |
| `Tag`       | `lodash@latest`                          | Dist-tag reference           |
| `Workspace` | `@internal/util@workspace:*`             | pnpm/yarn workspace protocol |
| `Git`       | `git+https://github.com/org/repo#v1.0.0` | Git repository reference     |
| `Path`      | `file:../local-pkg`                      | Local filesystem path        |
| `Url`       | `https://example.com/pkg.tgz`            | Tarball URL                  |
| `Alias`     | `my-lodash@npm:lodash@^4.0.0`            | Package aliasing             |

### Schema Definitions

```typescript
// ============================================================================
// Supporting Types
// ============================================================================

/**
 * npm scope name (the part after @ and before /).
 *
 * Validation rules:
 * - Lowercase letters, digits, hyphens, underscores, dots
 * - Cannot start with dot or underscore
 * - Maximum 214 characters (shared with full package name limit)
 *
 * @see {@link https://docs.npmjs.com/cli/v10/using-npm/scope | npm scope documentation}
 * @see {@link https://github.com/npm/validate-npm-package-name | validate-npm-package-name source}
 */
const Scope = S.String.pipe(
  S.pattern(/^[a-z0-9][a-z0-9-._]*$/),
  S.brand('Scope'),
)
type Scope = typeof Scope.Type

/**
 * npm package name (unscoped part only, without @scope/).
 *
 * Validation rules per npm specification:
 * - Lowercase letters, digits, hyphens, underscores, dots
 * - Cannot start with dot (.) or underscore (_)
 * - Cannot contain uppercase letters
 * - Cannot be a Node.js core module name
 * - Maximum 214 characters (including scope if present)
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#name | package.json name field}
 * @see {@link https://github.com/npm/validate-npm-package-name | validate-npm-package-name source}
 */
const Name = S.String.pipe(
  S.pattern(/^[a-z0-9][a-z0-9-._]*$/),
  S.brand('Name'),
)
type Name = typeof Name.Type

/**
 * Full npm package name: `@scope/name` or `name`.
 *
 * This is the structured representation. Use the schema's codec for
 * string encoding/decoding (e.g., `@kitz/core` ↔ `{ scope: "kitz", name: "core" }`).
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#name | package.json name field}
 */
class PackageName extends S.Class<PackageName>('PackageName')({
  /** Scope without the @ prefix. None for unscoped packages. */
  scope: S.OptionFromUndefinedOr(Scope),
  /** Package name without scope. */
  name: Name,
}) {}

/**
 * Semver range expression using @vltpkg/semver Range.
 *
 * Supports all npm semver range syntax:
 * - Exact: `1.0.0`
 * - Ranges: `>=1.0.0 <2.0.0`
 * - Caret: `^1.0.0` (compatible with version)
 * - Tilde: `~1.0.0` (approximately equivalent)
 * - Wildcards: `*`, `x`, `1.x`, `1.0.x`
 * - Hyphen: `1.0.0 - 2.0.0`
 * - OR: `^1.0.0 || ^2.0.0`
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies | npm dependencies}
 * @see {@link https://github.com/npm/node-semver#ranges | node-semver ranges}
 * @see {@link https://github.com/vltpkg/vltpkg/tree/main/src/semver | @vltpkg/semver source}
 */
const SemverRange = S.transformOrFail(
  S.String,
  S.declare((input): input is VltRange => input instanceof VltRange),
  {
    decode: (value, _, ast) => {
      try {
        return ParseResult.succeed(new VltRange(value))
      } catch (error) {
        return ParseResult.fail(
          new ParseResult.Type(ast, value, `Invalid semver range: ${error}`),
        )
      }
    },
    encode: (range) => ParseResult.succeed(range.toString()),
  },
)

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
 * @see {@link https://pnpm.io/workspaces#publishing-workspace-packages | pnpm workspace protocol}
 * @see {@link https://yarnpkg.com/features/workspaces#publishing-workspaces | yarn workspace protocol}
 */
const WorkspaceRange = S.Union(
  S.Literal('*'),
  S.Literal('^'),
  S.Literal('~'),
  SemverRange,
)

/**
 * npm dist-tag name.
 *
 * Common tags: `latest`, `next`, `beta`, `canary`, `rc`
 *
 * @see {@link https://docs.npmjs.com/cli/v10/commands/npm-dist-tag | npm dist-tag command}
 */
const DistTag = S.NonEmptyString.pipe(S.brand('DistTag'))
type DistTag = typeof DistTag.Type

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
class Range extends S.TaggedClass<Range>()('PinRange', {
  name: PackageName,
  range: SemverRange,
}) {}

/**
 * Dist-tag dependency: `lodash@latest`
 *
 * References a named version tag rather than a semver range.
 * Tags are mutable pointers managed by `npm dist-tag`.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/commands/npm-dist-tag | npm dist-tag command}
 */
class Tag extends S.TaggedClass<Tag>()('PinTag', {
  name: PackageName,
  tag: DistTag,
}) {}

/**
 * Workspace protocol dependency: `@internal/util@workspace:*`
 *
 * References a package in the same monorepo workspace.
 * The specifier is resolved at publish time to an actual version.
 *
 * @see {@link https://pnpm.io/workspaces#publishing-workspace-packages | pnpm workspace protocol}
 * @see {@link https://yarnpkg.com/features/workspaces#publishing-workspaces | yarn workspace protocol}
 */
class Workspace extends S.TaggedClass<Workspace>()('PinWorkspace', {
  name: PackageName,
  range: WorkspaceRange,
}) {}

/**
 * Git repository dependency: `git+https://github.com/org/repo#v1.0.0`
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
class Git extends S.TaggedClass<Git>()('PinGit', {
  name: PackageName,
  /** Full git URL including protocol. */
  url: S.String,
  /** Git ref: branch, tag, or commit SHA. */
  ref: S.OptionFromUndefinedOr(S.String),
  /** Semver range for git tags (used with #semver: fragment). */
  semver: S.OptionFromUndefinedOr(SemverRange),
}) {}

/**
 * Local path dependency: `file:../local-pkg`
 *
 * References a package on the local filesystem. Path is relative
 * to the package.json containing the dependency.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#local-paths | npm local paths}
 */
class Path extends S.TaggedClass<Path>()('PinPath', {
  name: PackageName,
  /** Relative or absolute filesystem path. */
  path: S.String,
}) {}

/**
 * Tarball URL dependency: `https://example.com/pkg-1.0.0.tgz`
 *
 * Installs from a remote tarball URL. Must be a valid URL
 * pointing to a `.tgz` or `.tar.gz` file.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#urls-as-dependencies | npm URLs}
 */
class Url extends S.TaggedClass<Url>()('PinUrl', {
  name: PackageName,
  /** Full URL to the tarball. */
  url: S.String,
}) {}

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
class Alias extends S.TaggedClass<Alias>()('PinAlias', {
  /** The alias name (what you import as). */
  name: PackageName,
  /** The actual package being installed. */
  target: PackageName,
  /** Version specifier for the target package. */
  specifier: S.suspend(() => Pin),
}) {}

// ============================================================================
// Union
// ============================================================================

/**
 * Package dependency specifier union.
 *
 * Represents any valid dependency format from package.json.
 * Use {@link fromString} for type-safe literal parsing.
 *
 * @see {@link https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies | npm dependencies}
 */
const Pin = S.Union(Range, Tag, Workspace, Git, Path, Url, Alias)
type Pin = typeof Pin.Type
```

### Type-Level Parsing

Like `Fs.Path.fromString`, `Pin.fromString` preserves literal types at compile time:

````typescript
// ============================================================================
// Type-Level Package Name Parser
// ============================================================================

/**
 * Parse package name from string literal.
 * "@scope/name" → { scope: "scope"; name: "name" }
 * "name"        → { scope: undefined; name: "name" }
 */
type ParsePackageName<$S extends string> = $S extends
  `@${infer $Scope}/${infer $Name}` ? { scope: $Scope; name: $Name }
  : { scope: undefined; name: $S }

// ============================================================================
// Type-Level Specifier Variant Detection
// ============================================================================

/**
 * Detect if string looks like a semver range.
 * Matches: ^, ~, >=, <=, >, <, =, *, digits
 */
type IsRangeLike<$S extends string> = $S extends `^${string}` ? true
  : $S extends `~${string}` ? true
  : $S extends `>${string}` ? true
  : $S extends `<${string}` ? true
  : $S extends `=${string}` ? true
  : $S extends `*` ? true
  : $S extends `${number}${string}` ? true
  : false

/**
 * Parse specifier to determine variant.
 */
type ParseSpecifier<$S extends string> = $S extends `workspace:${infer $Range}`
  ? { _tag: 'PinWorkspace'; range: $Range }
  : $S extends `git+${infer $Url}` ? { _tag: 'PinGit'; url: `git+${$Url}` }
  : $S extends `file:${infer $Path}` ? { _tag: 'PinPath'; path: $Path }
  : $S extends `https://${infer $Rest}`
    ? { _tag: 'PinUrl'; url: `https://${$Rest}` }
  : $S extends `http://${infer $Rest}`
    ? { _tag: 'PinUrl'; url: `http://${$Rest}` }
  : $S extends `npm:${infer $Target}@${infer $Spec}`
    ? { _tag: 'PinAlias'; target: ParsePackageName<$Target>; specifier: $Spec }
  : IsRangeLike<$S> extends true ? { _tag: 'PinRange'; range: $S }
  : { _tag: 'PinTag'; tag: $S }

// ============================================================================
// Type-Level Pin Parser
// ============================================================================

/**
 * Build typed Pin variant from parsed specifier and name.
 */
type BuildPin<
  $Spec extends { _tag: string },
  $Name extends { scope: string | undefined; name: string },
> = $Spec extends { _tag: 'PinRange'; range: infer $R extends string }
  ? Range & { name: PackageName & $Name; range: $R }
  : $Spec extends { _tag: 'PinTag'; tag: infer $T extends string }
    ? Tag & { name: PackageName & $Name; tag: $T }
  : $Spec extends { _tag: 'PinWorkspace'; range: infer $R extends string }
    ? Workspace & { name: PackageName & $Name; range: $R }
  : $Spec extends { _tag: 'PinGit'; url: infer $U extends string }
    ? Git & { name: PackageName & $Name; url: $U }
  : $Spec extends { _tag: 'PinPath'; path: infer $P extends string }
    ? Path & { name: PackageName & $Name; path: $P }
  : $Spec extends { _tag: 'PinUrl'; url: infer $U extends string }
    ? Url & { name: PackageName & $Name; url: $U }
  : $Spec extends { _tag: 'PinAlias'; target: infer $T; specifier: infer $S }
    ? Alias & { name: PackageName & $Name; target: $T; specifier: $S }
  : never

/**
 * Full pin parser: "name@specifier" → typed Pin variant
 */
type ParsePin<$S extends string> =
  // Scoped package: @scope/name@specifier
  $S extends `@${infer $Scope}/${infer $Name}@${infer $Spec}`
    ? BuildPin<ParseSpecifier<$Spec>, { scope: $Scope; name: $Name }>
    // Unscoped package: name@specifier
    : $S extends `${infer $Name}@${infer $Spec}`
      ? BuildPin<ParseSpecifier<$Spec>, { scope: undefined; name: $Name }>
    : never

// ============================================================================
// Per-Variant Constructors
// ============================================================================

/**
 * Each variant has its own `fromString` for direct construction when
 * you already know the type. These are colocated with their schema class.
 */

class Range extends S.TaggedClass<Range>()('PinRange', {/* ... */}) {
  static is = S.is(Range)

  /**
   * Parse a range pin from string. Use when you know it's a range.
   *
   * @example
   * ```ts
   * const pin = Range.fromString('@kitz/core@^1.0.0')
   * //    ^? Range & { name: { scope: "kitz"; name: "core" }; range: "^1.0.0" }
   * ```
   */
  static fromString = <$S extends string>(
    input: $S,
  ): ParseRangePin<$S> => parseRange(input) as any
}

class Tag extends S.TaggedClass<Tag>()('PinTag', {/* ... */}) {
  static is = S.is(Tag)

  /**
   * Parse a tag pin from string. Use when you know it's a dist-tag.
   *
   * @example
   * ```ts
   * const pin = Tag.fromString('lodash@latest')
   * //    ^? Tag & { name: { scope: undefined; name: "lodash" }; tag: "latest" }
   * ```
   */
  static fromString = <$S extends string>(
    input: $S,
  ): ParseTagPin<$S> => parseTag(input) as any
}

// ... similar pattern for Workspace, Git, Path, Url, Alias

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
 * //    ^? Range & { name: { scope: "kitz"; name: "core" }; range: "^1.0.0" }
 *
 * const b = Pin.fromString('lodash@latest')
 * //    ^? Tag & { name: { scope: undefined; name: "lodash" }; tag: "latest" }
 *
 * // Known variant - use directly
 * const c = Range.fromString('@kitz/core@^1.0.0')
 * const d = Tag.fromString('lodash@latest')
 * ```
 */
const fromString = <$S extends string>(input: $S): ParsePin<$S> => {
  // Thin dispatch logic - detect specifier type and delegate
  const specifier = extractSpecifier(input)

  if (specifier.startsWith('workspace:')) {
    return Workspace.fromString(input) as any
  }
  if (specifier.startsWith('git+')) return Git.fromString(input) as any
  if (specifier.startsWith('file:')) return Path.fromString(input) as any
  if (specifier.startsWith('https://') || specifier.startsWith('http://')) {
    return Url.fromString(input) as any
  }
  if (specifier.startsWith('npm:')) return Alias.fromString(input) as any
  if (isRangeLike(specifier)) return Range.fromString(input) as any
  return Tag.fromString(input) as any
}
````

### Usage Examples

```typescript
// ============================================================================
// Root dispatcher - use when variant is unknown
// ============================================================================

const a = Pin.fromString('@kitz/core@^1.0.0')
//    ^? Range & { name: { scope: "kitz"; name: "core" }; range: "^1.0.0" }

const b = Pin.fromString('lodash@latest')
//    ^? Tag & { name: { scope: undefined; name: "lodash" }; tag: "latest" }

const c = Pin.fromString('@internal/util@workspace:*')
//    ^? Workspace & { name: { scope: "internal"; name: "util" }; range: "*" }

// ============================================================================
// Per-variant constructors - use when you know the type
// ============================================================================

// More explicit, avoids dispatch overhead, clearer intent
const d = Range.fromString('@kitz/core@^1.0.0')
//    ^? Range & { name: { scope: "kitz"; name: "core" }; range: "^1.0.0" }

const e = Tag.fromString('lodash@latest')
//    ^? Tag & { name: { scope: undefined; name: "lodash" }; tag: "latest" }

const f = Workspace.fromString('@internal/util@workspace:*')
//    ^? Workspace & { name: { scope: "internal"; name: "util" }; range: "*" }

const g = Path.fromString('my-pkg@file:../shared')
//    ^? Path & { name: { scope: undefined; name: "my-pkg" }; path: "../shared" }

// ============================================================================
// Schema encoding round-trips
// ============================================================================

const encoded = S.encodeSync(Pin)(a)
// "@kitz/core@^1.0.0"

const decoded = S.decodeSync(Pin)(encoded)
// Range { name: PackageName, range: VltRange }

// Pattern matching (use S.encodeSync(PackageName) for string representation)
const nameToString = S.encodeSync(PackageName)

const display = (pin: Pin): string =>
  Match.value(pin).pipe(
    Match.tagsExhaustive({
      PinRange: (p) => `${nameToString(p.name)} requires ${p.range}`,
      PinTag: (p) => `${nameToString(p.name)} @ dist-tag ${p.tag}`,
      PinWorkspace: (p) => `${nameToString(p.name)} (workspace)`,
      PinGit: (p) => `${nameToString(p.name)} from git`,
      PinPath: (p) => `${nameToString(p.name)} from ${p.path}`,
      PinUrl: (p) => `${nameToString(p.name)} from URL`,
      PinAlias: (p) => `${nameToString(p.name)} → ${nameToString(p.target)}`,
    }),
  )
```

### String Codec Format

The codec uses `name@specifier` format with variant-specific prefixes:

| Variant   | Encoded Format                            |
| --------- | ----------------------------------------- |
| Range     | `@scope/pkg@^1.0.0` or `pkg@^1.0.0`       |
| Tag       | `@scope/pkg@latest` or `pkg@latest`       |
| Workspace | `@scope/pkg@workspace:*`                  |
| Git       | `pkg@git+https://github.com/org/repo#ref` |
| Path      | `pkg@file:../path`                        |
| Url       | `pkg@https://example.com/pkg.tgz`         |
| Alias     | `alias-name@npm:real-pkg@^1.0.0`          |

## File Structure

```
packages/pkg/src/
├── _.ts                    # Public exports
├── __.ts                   # Namespace exports
├── manifest.ts             # Existing package.json manifest
├── pin/
│   ├── _.ts                # Pin module barrel
│   ├── __.ts               # Pin namespace
│   ├── pin.ts              # Pin union + fromString
│   ├── package-name.ts     # PackageName schema
│   ├── semver-range.ts     # SemverRange schema (wraps @vltpkg/semver)
│   ├── variants/
│   │   ├── range.ts
│   │   ├── tag.ts
│   │   ├── workspace.ts
│   │   ├── git.ts
│   │   ├── path.ts
│   │   ├── url.ts
│   │   └── alias.ts
│   └── parse.ts            # Type-level parser types
└── ...
```

## Dependencies

- `@vltpkg/semver` - Already used in `@kitz/semver`, provides Range parsing
- `effect` - Schema, Option, Match

## Future Considerations

1. **Git URL parsing** - Could decompose into host/org/repo/ref components
2. **Workspace resolution** - Could resolve `workspace:^` to actual version from workspace
3. **Registry support** - Could support custom registries in specifiers
4. **Node core module blocklist** - Name validation could reject `fs`, `path`, etc.
