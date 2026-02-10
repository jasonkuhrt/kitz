import { Assert } from '@kitz/assert'
import * as Pin from './pin.js'

// fromString should infer specific types from literal strings

// Range - semver patterns (^, ~, >=, etc., digits, *, x)
type _range = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'@kitz/core@^1.0.0'>>,
  Pin.Range
>

type _rangeTilde = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'lodash@~4.17.0'>>,
  Pin.Range
>

type _rangeExact = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'express@4.18.0'>>,
  Pin.Range
>

type _rangeWildcard = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'pkg@*'>>,
  Pin.Range
>

// Tag - dist-tag names
type _tagLatest = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'lodash@latest'>>,
  Pin.Tag
>

type _tagNext = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'@kitz/core@next'>>,
  Pin.Tag
>

// Workspace - workspace: protocol
type _workspace = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'@internal/util@workspace:*'>>,
  Pin.Workspace
>

type _workspaceCaret = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'@kitz/core@workspace:^'>>,
  Pin.Workspace
>

// Git - git+ or github: prefixes
type _git = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'my-pkg@git+https://github.com/org/repo'>>,
  Pin.Git
>

type _gitWithRef = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'my-pkg@git+https://github.com/org/repo#v1.0.0'>>,
  Pin.Git
>

type _gitHub = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'my-pkg@github:user/repo'>>,
  Pin.Git
>

// Path - file: protocol
type _path = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'my-pkg@file:../shared'>>,
  Pin.Path
>

type _pathAbsolute = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'@local/util@file:/absolute/path'>>,
  Pin.Path
>

// Url - https:// or http://
type _url = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'my-pkg@https://example.com/pkg-1.0.0.tgz'>>,
  Pin.Url
>

type _urlHttp = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'custom@http://registry.internal/custom.tar.gz'>>,
  Pin.Url
>

// Alias - npm: protocol
type _alias = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'my-lodash@npm:lodash@^4.0.0'>>,
  Pin.Alias
>

type _aliasScoped = Assert.exact.of<
  ReturnType<typeof Pin.fromString<'@my/react@npm:react@^18.0.0'>>,
  Pin.Alias
>

// Plain string should return Pin union
type _plainString = Assert.exact.of<
  ReturnType<typeof Pin.fromString<string>>,
  Pin.Pin
>

// fromLiteral should infer specific types from literal strings (path-style API)
type _literalExact = Assert.exact.of<
  ReturnType<typeof Pin.fromLiteral<'@kitz/core@1.0.0'>>,
  Pin.Exact
>

type _literalRange = Assert.exact.of<
  ReturnType<typeof Pin.fromLiteral<'@kitz/core@^1.0.0'>>,
  Pin.Range
>
